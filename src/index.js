import { QuizSession } from './durable-objects/quiz-session.js'

export { QuizSession }

export default {
  async fetch (request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // Route: Test Durable Object
      if (path === '/api/test-do' && request.method === 'GET') {
        return await testDurableObject(env, corsHeaders)
      }

      // Route: Get popular topics
      if (path === '/api/popular-topics' && request.method === 'GET') {
        return await getPopularTopics(env, corsHeaders)
      }

      // Route: Generate new quiz
      if (path === '/api/generate-quiz' && request.method === 'POST') {
        return await generateQuiz(request, env, corsHeaders)
      }

      // Route: Get quiz session
      if (path.startsWith('/api/quiz/') && request.method === 'GET') {
        const sessionId = path.split('/')[3]
        return await getQuizSession(sessionId, env, corsHeaders)
      }

      // Route: Submit answer
      if (
        path.startsWith('/api/quiz/') &&
        path.endsWith('/answer') &&
        request.method === 'POST'
      ) {
        const sessionId = path.split('/')[3]
        return await submitAnswer(sessionId, request, env, corsHeaders)
      }

      // Route: Get next question
      if (
        path.startsWith('/api/quiz/') &&
        path.endsWith('/next') &&
        request.method === 'POST'
      ) {
        const sessionId = path.split('/')[3]
        return await getNextQuestion(sessionId, env, corsHeaders)
      }

      return new Response('AI Quiz App API', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    } catch (error) {
      console.error('Error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}

async function getPopularTopics (env, corsHeaders) {
  try {
    // Get the popular topics from KV
    const popularTopicsData = await env.QUIZ_KV.get('popular-topics')
    
    if (!popularTopicsData) {
      // Return default topics if no data exists
      const defaultTopics = [
        { topic: 'JavaScript', count: 0 },
        { topic: 'Python', count: 0 },
        { topic: 'React', count: 0 },
        { topic: 'Node.js', count: 0 },
        { topic: 'CSS', count: 0 },
        { topic: 'HTML', count: 0 },
        { topic: 'SQL', count: 0 },
        { topic: 'Git', count: 0 },
        { topic: 'Algorithms', count: 0 },
        { topic: 'Data Structures', count: 0 }
      ]
      
      return new Response(JSON.stringify({ topics: defaultTopics }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const topics = JSON.parse(popularTopicsData)
    
    // Sort by count (most popular first) and return top 10
    const sortedTopics = topics
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return new Response(JSON.stringify({ topics: sortedTopics }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error getting popular topics:', error)
    return new Response(JSON.stringify({ error: 'Failed to get popular topics' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function testDurableObject (env, corsHeaders) {
  try {
    const testId = 'test-session'
    const durableObjectId = env.QUIZ_SESSION.idFromName(testId)
    const quizSession = env.QUIZ_SESSION.get(durableObjectId)

    console.log('Testing Durable Object...')
    const response = await quizSession.fetch('http://internal/status')
    console.log('DO response status:', response.status)

    const result = await response.text()
    console.log('DO response:', result)

    return new Response(
      JSON.stringify({
        status: response.status,
        result: result,
        testId: testId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('DO test error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function generateQuiz (request, env, corsHeaders) {
  const {
    topic,
    difficulty = 'medium',
    questionCount = 5
  } = await request.json()

  if (!topic) {
    return new Response(JSON.stringify({ error: 'Topic is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Generate quiz using Llama 3.1
    const quizData = await generateQuizWithAI(
      topic,
      difficulty,
      questionCount,
      env
    )

    // Create a new quiz session - simplified approach using KV directly
    const sessionId = crypto.randomUUID()

    const sessionData = {
      sessionId,
      topic,
      difficulty,
      questions: quizData.questions,
      totalQuestions: questionCount,
      currentQuestionIndex: 0,
      answers: [],
      score: 0,
      completed: false,
      startTime: Date.now(),
      endTime: null
    }

    // Store session in KV
    await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData))

    // Track topic popularity
    await trackTopicPopularity(topic, env)

    return new Response(
      JSON.stringify({
        sessionId,
        topic,
        difficulty,
        totalQuestions: questionCount,
        currentQuestion: 1,
        questions: quizData.questions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Quiz generation error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate quiz' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function trackTopicPopularity (topic, env) {
  try {
    // Get current popular topics
    const popularTopicsData = await env.QUIZ_KV.get('popular-topics')
    
    let topics = []
    if (popularTopicsData) {
      topics = JSON.parse(popularTopicsData)
    }

    // Find existing topic or create new one
    let existingTopic = topics.find(t => t.topic.toLowerCase() === topic.toLowerCase())
    
    if (existingTopic) {
      // Increment count for existing topic
      existingTopic.count += 1
      existingTopic.lastUsed = Date.now()
    } else {
      // Add new topic
      topics.push({
        topic: topic,
        count: 1,
        lastUsed: Date.now()
      })
    }

    // Keep only top 50 topics to avoid storage bloat
    topics = topics
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)

    // Store updated topics
    await env.QUIZ_KV.put('popular-topics', JSON.stringify(topics))
    
    console.log(`Tracked topic: ${topic}, count: ${existingTopic ? existingTopic.count : 1}`)
  } catch (error) {
    console.error('Error tracking topic popularity:', error)
    // Don't throw error - this shouldn't break quiz generation
  }
}

async function generateQuizWithAI (topic, difficulty, questionCount, env) {
  const prompt = `Generate ${questionCount} multiple choice quiz questions about "${topic}" with ${difficulty} difficulty level. 
  
  Format your response as a JSON object with this exact structure:
  {
    "questions": [
      {
        "id": 1,
        "question": "Question text here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": 0,
        "explanation": "Explanation of why this answer is correct"
      }
    ]
  }
  
  Make sure the questions are educational and test understanding of the topic.`

  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.7
  })

  try {
    const content = response.response
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    } else {
      throw new Error('No valid JSON found in AI response')
    }
  } catch (error) {
    console.error('Error parsing AI response:', error)
    // Fallback: create a simple quiz if AI response is malformed
    return {
      questions: [
        {
          id: 1,
          question: `What is the main topic of "${topic}"?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 0,
          explanation: 'This is a sample question generated as a fallback.'
        }
      ]
    }
  }
}

async function getQuizSession (sessionId, env, corsHeaders) {
  try {
    const sessionDataStr = await env.QUIZ_KV.get(`session:${sessionId}`)

    if (!sessionDataStr) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const sessionData = JSON.parse(sessionDataStr)
    const currentQuestion =
      sessionData.questions[sessionData.currentQuestionIndex]

    return new Response(
      JSON.stringify({
        session: sessionData,
        currentQuestion: currentQuestion,
        progress: {
          current: sessionData.currentQuestionIndex + 1,
          total: sessionData.totalQuestions,
          percentage: Math.round(
            ((sessionData.currentQuestionIndex + 1) /
              sessionData.totalQuestions) *
              100
          )
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error getting quiz session:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function submitAnswer (sessionId, request, env, corsHeaders) {
  try {
    const { answer } = await request.json()

    // Get session data from KV
    const sessionDataStr = await env.QUIZ_KV.get(`session:${sessionId}`)

    if (!sessionDataStr) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const sessionData = JSON.parse(sessionDataStr)

    if (sessionData.completed) {
      return new Response(JSON.stringify({ error: 'Quiz already completed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const currentQuestion =
      sessionData.questions[sessionData.currentQuestionIndex]

    if (!currentQuestion) {
      return new Response(JSON.stringify({ error: 'No current question' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isCorrect = answer === currentQuestion.correctAnswer

    // Record the answer
    sessionData.answers.push({
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      userAnswer: answer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: isCorrect,
      explanation: currentQuestion.explanation,
      timestamp: Date.now()
    })

    if (isCorrect) {
      sessionData.score++
    }

    // Update KV storage
    await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData))

    return new Response(
      JSON.stringify({
        isCorrect,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        score: sessionData.score,
        totalAnswered: sessionData.answers.length,
        isLastQuestion:
          sessionData.currentQuestionIndex === sessionData.totalQuestions - 1
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error submitting answer:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getNextQuestion (sessionId, env, corsHeaders) {
  try {
    // Get session data from KV
    const sessionDataStr = await env.QUIZ_KV.get(`session:${sessionId}`)

    if (!sessionDataStr) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const sessionData = JSON.parse(sessionDataStr)

    if (sessionData.completed) {
      return new Response(
        JSON.stringify({
          error: 'Quiz completed',
          finalScore: sessionData.score,
          totalQuestions: sessionData.totalQuestions,
          percentage: Math.round(
            (sessionData.score / sessionData.totalQuestions) * 100
          )
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Move to next question
    sessionData.currentQuestionIndex++

    // Check if quiz is completed
    if (sessionData.currentQuestionIndex >= sessionData.totalQuestions) {
      sessionData.completed = true
      sessionData.endTime = Date.now()

      // Update KV storage
      await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData))

      return new Response(
        JSON.stringify({
          completed: true,
          finalScore: sessionData.score,
          totalQuestions: sessionData.totalQuestions,
          percentage: Math.round(
            (sessionData.score / sessionData.totalQuestions) * 100
          ),
          answers: sessionData.answers,
          timeSpent: sessionData.endTime - sessionData.startTime
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const nextQuestion = sessionData.questions[sessionData.currentQuestionIndex]

    // Update KV storage
    await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData))

    return new Response(
      JSON.stringify({
        question: nextQuestion,
        progress: {
          current: sessionData.currentQuestionIndex + 1,
          total: sessionData.totalQuestions,
          percentage: Math.round(
            ((sessionData.currentQuestionIndex + 1) /
              sessionData.totalQuestions) *
              100
          )
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error getting next question:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
