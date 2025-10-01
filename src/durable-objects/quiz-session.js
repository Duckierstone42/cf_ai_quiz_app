export class QuizSession {
  constructor (state, env) {
    this.state = state
    this.env = env
    this.sessionData = null
  }

  async fetch (request) {
    const url = new URL(request.url)
    const path = url.pathname

    console.log(`QuizSession: ${request.method} ${path}`)

    try {
      // Initialize quiz session
      if (path === '/internal/init' && request.method === 'POST') {
        console.log('Initializing session...')
        return await this.initializeSession(request)
      }

      // Get session status
      if (path === '/internal/status') {
        return await this.getSessionStatus()
      }

      // Submit answer
      if (path === '/internal/answer' && request.method === 'POST') {
        return await this.submitAnswer(request)
      }

      // Get next question
      if (path === '/internal/next' && request.method === 'POST') {
        return await this.getNextQuestion()
      }

      return new Response('Not found', { status: 404 })
    } catch (error) {
      console.error('QuizSession error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  async initializeSession (request) {
    try {
      console.log('Starting session initialization...')
      const data = await request.json()
      console.log('Received data:', {
        sessionId: data.sessionId,
        topic: data.topic
      })

      this.sessionData = {
        sessionId: data.sessionId,
        topic: data.topic,
        difficulty: data.difficulty,
        questions: data.questions,
        totalQuestions: data.totalQuestions,
        currentQuestionIndex: 0,
        answers: [],
        score: 0,
        completed: false,
        startTime: Date.now(),
        endTime: null
      }

      console.log('Session data created, storing in KV...')
      // Store in KV for persistence
      await this.env.QUIZ_KV.put(
        `session:${data.sessionId}`,
        JSON.stringify(this.sessionData)
      )

      console.log('Session initialized successfully')
      return new Response(
        JSON.stringify({
          success: true,
          session: this.sessionData
        }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } catch (error) {
      console.error('Error in initializeSession:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  async getSessionStatus () {
    if (!this.sessionData) {
      // Try to load session data from KV
      await this.loadSessionFromKV()

      if (!this.sessionData) {
        return new Response(
          JSON.stringify({ error: 'Session not initialized' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }

    return new Response(
      JSON.stringify({
        session: this.sessionData,
        currentQuestion: this.getCurrentQuestion(),
        progress: {
          current: this.sessionData.currentQuestionIndex + 1,
          total: this.sessionData.totalQuestions,
          percentage: Math.round(
            ((this.sessionData.currentQuestionIndex + 1) /
              this.sessionData.totalQuestions) *
              100
          )
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  async submitAnswer (request) {
    if (!this.sessionData) {
      // Try to load session data from KV
      await this.loadSessionFromKV()

      if (!this.sessionData) {
        return new Response(
          JSON.stringify({ error: 'Session not initialized' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }

    if (this.sessionData.completed) {
      return new Response(JSON.stringify({ error: 'Quiz already completed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { answer } = await request.json()
    const currentQuestion = this.getCurrentQuestion()

    if (!currentQuestion) {
      return new Response(JSON.stringify({ error: 'No current question' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const isCorrect = answer === currentQuestion.correctAnswer

    // Record the answer
    this.sessionData.answers.push({
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      userAnswer: answer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: isCorrect,
      explanation: currentQuestion.explanation,
      timestamp: Date.now()
    })

    if (isCorrect) {
      this.sessionData.score++
    }

    // Update KV storage
    await this.env.QUIZ_KV.put(
      `session:${this.sessionData.sessionId}`,
      JSON.stringify(this.sessionData)
    )

    return new Response(
      JSON.stringify({
        isCorrect,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        score: this.sessionData.score,
        totalAnswered: this.sessionData.answers.length,
        isLastQuestion:
          this.sessionData.currentQuestionIndex ===
          this.sessionData.totalQuestions - 1
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  async getNextQuestion () {
    if (!this.sessionData) {
      // Try to load session data from KV
      await this.loadSessionFromKV()

      if (!this.sessionData) {
        return new Response(
          JSON.stringify({ error: 'Session not initialized' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }

    if (this.sessionData.completed) {
      return new Response(
        JSON.stringify({
          error: 'Quiz completed',
          finalScore: this.sessionData.score,
          totalQuestions: this.sessionData.totalQuestions,
          percentage: Math.round(
            (this.sessionData.score / this.sessionData.totalQuestions) * 100
          )
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Move to next question
    this.sessionData.currentQuestionIndex++

    // Check if quiz is completed
    if (
      this.sessionData.currentQuestionIndex >= this.sessionData.totalQuestions
    ) {
      this.sessionData.completed = true
      this.sessionData.endTime = Date.now()

      // Update KV storage
      await this.env.QUIZ_KV.put(
        `session:${this.sessionData.sessionId}`,
        JSON.stringify(this.sessionData)
      )

      return new Response(
        JSON.stringify({
          completed: true,
          finalScore: this.sessionData.score,
          totalQuestions: this.sessionData.totalQuestions,
          percentage: Math.round(
            (this.sessionData.score / this.sessionData.totalQuestions) * 100
          ),
          answers: this.sessionData.answers,
          timeSpent: this.sessionData.endTime - this.sessionData.startTime
        }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const nextQuestion = this.getCurrentQuestion()

    // Update KV storage
    await this.env.QUIZ_KV.put(
      `session:${this.sessionData.sessionId}`,
      JSON.stringify(this.sessionData)
    )

    return new Response(
      JSON.stringify({
        question: nextQuestion,
        progress: {
          current: this.sessionData.currentQuestionIndex + 1,
          total: this.sessionData.totalQuestions,
          percentage: Math.round(
            ((this.sessionData.currentQuestionIndex + 1) /
              this.sessionData.totalQuestions) *
              100
          )
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  getCurrentQuestion () {
    if (
      !this.sessionData ||
      this.sessionData.currentQuestionIndex >= this.sessionData.questions.length
    ) {
      return null
    }
    return this.sessionData.questions[this.sessionData.currentQuestionIndex]
  }

  async loadSessionFromKV () {
    try {
      // We need to get the session ID from the state or request
      // For now, let's try to get it from the state
      const sessionId = this.state.id.name
      if (sessionId) {
        const sessionDataStr = await this.env.QUIZ_KV.get(
          `session:${sessionId}`
        )
        if (sessionDataStr) {
          this.sessionData = JSON.parse(sessionDataStr)
        }
      }
    } catch (error) {
      console.error('Error loading session from KV:', error)
    }
  }
}
