class QuizApp {
  constructor () {
    this.currentSession = null
    this.currentQuestion = null
    this.selectedAnswer = null
    this.apiBase = '' // Will be set based on environment

    this.initializeEventListeners()
    this.setApiBase()
    this.loadPopularTopics()
  }

  setApiBase () {
    // In production, this would be your deployed Worker URL
    // For development, you might use localhost or a staging URL
    if (window.location.hostname === 'localhost') {
      this.apiBase = 'http://localhost:8787'
    } else {
      // Production Worker URL
      this.apiBase = 'https://ai-quiz-app.ankiththalanki2005.workers.dev'
    }
  }

  initializeEventListeners () {
    // Quiz form submission
    document.getElementById('quiz-form').addEventListener('submit', e => {
      e.preventDefault()
      this.generateQuiz()
    })

    // Answer submission
    document.getElementById('submit-answer').addEventListener('click', () => {
      this.submitAnswer()
    })

    // Next question
    document.getElementById('next-question').addEventListener('click', () => {
      this.getNextQuestion()
    })

    // New quiz
    document.getElementById('new-quiz-btn').addEventListener('click', () => {
      this.resetQuiz()
    })

    // Retry button
    document.getElementById('retry-btn').addEventListener('click', () => {
      this.hideError()
      this.generateQuiz()
    })

    // Refresh topics button
    document.getElementById('refresh-topics').addEventListener('click', () => {
      this.loadPopularTopics()
    })
  }

  async loadPopularTopics () {
    try {
      const response = await fetch(`${this.apiBase}/api/popular-topics`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      this.displayPopularTopics(data.topics)
    } catch (error) {
      console.error('Error loading popular topics:', error)
      this.displayPopularTopics([])
    }
  }

  displayPopularTopics (topics) {
    const topicsList = document.getElementById('topics-list')
    
    if (!topics || topics.length === 0) {
      topicsList.innerHTML = '<p style="text-align: center; color: #718096;">No popular topics yet. Create some quizzes to see trending topics!</p>'
      return
    }

    topicsList.innerHTML = topics.map((topic, index) => `
      <div class="topic-item" data-topic="${topic.topic}">
        <div class="topic-rank">${index + 1}</div>
        <div class="topic-name">${topic.topic}</div>
        <div class="topic-count">${topic.count} quiz${topic.count !== 1 ? 'es' : ''}</div>
      </div>
    `).join('')

    // Add click handlers to topic items
    document.querySelectorAll('.topic-item').forEach(item => {
      item.addEventListener('click', () => {
        const topic = item.dataset.topic
        this.selectTopicFromPopular(topic)
      })
    })
  }

  selectTopicFromPopular (topic) {
    // Fill the topic input and scroll to quiz setup
    document.getElementById('topic').value = topic
    document.getElementById('quiz-setup').scrollIntoView({ behavior: 'smooth' })
    
    // Highlight the input briefly
    const topicInput = document.getElementById('topic')
    topicInput.style.backgroundColor = '#e6fffa'
    setTimeout(() => {
      topicInput.style.backgroundColor = ''
    }, 1000)
  }

  async generateQuiz () {
    const topic = document.getElementById('topic').value.trim()
    const difficulty = document.getElementById('difficulty').value
    const questionCount = parseInt(
      document.getElementById('question-count').value
    )

    if (!topic) {
      this.showError('Please enter a topic for your quiz')
      return
    }

    this.showLoading()
    this.hideError()

    try {
      const response = await fetch(`${this.apiBase}/api/generate-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic,
          difficulty,
          questionCount
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      this.currentSession = data
      this.currentSession.startTime = Date.now() // Add start time for frontend calculation
      this.showQuizTaking()
      this.displayCurrentQuestion()
    } catch (error) {
      console.error('Error generating quiz:', error)
      this.showError(`Failed to generate quiz: ${error.message}`)
    }
  }

  async displayCurrentQuestion () {
    if (!this.currentSession) return

    const questionIndex = this.currentSession.currentQuestion - 1
    const question = this.currentSession.questions[questionIndex]

    if (!question) {
      this.showError('No question available')
      return
    }

    this.currentQuestion = question

    // Update progress
    this.updateProgress()

    // Display question
    document.getElementById('question-text').textContent = question.question

    // Clear any existing explanations
    const existingExplanation = document.querySelector('.explanation')
    if (existingExplanation) {
      existingExplanation.remove()
    }

    // Display options
    const optionsContainer = document.getElementById('options-container')
    optionsContainer.innerHTML = ''

    question.options.forEach((option, index) => {
      const optionElement = document.createElement('div')
      optionElement.className = 'option'
      optionElement.textContent = option
      optionElement.addEventListener('click', () => {
        this.selectAnswer(index)
      })
      optionsContainer.appendChild(optionElement)
    })

    // Reset buttons
    document.getElementById('submit-answer').disabled = true
    document.getElementById('submit-answer').style.display = 'block'
    document.getElementById('next-question').style.display = 'none'
    this.selectedAnswer = null
  }

  selectAnswer (answerIndex) {
    this.selectedAnswer = answerIndex

    // Update UI
    const options = document.querySelectorAll('.option')
    options.forEach((option, index) => {
      option.classList.remove('selected')
      if (index === answerIndex) {
        option.classList.add('selected')
      }
    })

    document.getElementById('submit-answer').disabled = false
  }

  async submitAnswer () {
    if (this.selectedAnswer === null) return

    try {
      const response = await fetch(
        `${this.apiBase}/api/quiz/${this.currentSession.sessionId}/answer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            answer: this.selectedAnswer
          })
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      // Show correct/incorrect feedback
      this.showAnswerFeedback(result)

      // Update UI
      document.getElementById('submit-answer').style.display = 'none'

      if (result.isLastQuestion) {
        // Quiz completed - get the final results
        setTimeout(async () => {
          try {
            const finalResponse = await fetch(
              `${this.apiBase}/api/quiz/${this.currentSession.sessionId}/next`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            )

            if (finalResponse.ok) {
              const finalResult = await finalResponse.json()
              this.showQuizResults(finalResult)
            } else {
              // Fallback to current result
              this.showQuizResults(result)
            }
          } catch (error) {
            console.error('Error getting final results:', error)
            // Fallback to current result
            this.showQuizResults(result)
          }
        }, 2000)
      } else {
        document.getElementById('next-question').style.display = 'block'
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      this.showError(`Failed to submit answer: ${error.message}`)
    }
  }

  showAnswerFeedback (result) {
    const options = document.querySelectorAll('.option')
    options.forEach((option, index) => {
      if (index === result.correctAnswer) {
        option.classList.add('correct')
      } else if (index === this.selectedAnswer && !result.isCorrect) {
        option.classList.add('incorrect')
      }
    })

    // Show explanation if it exists
    if (result.explanation) {
      const explanation = document.createElement('div')
      explanation.className = 'explanation'
      explanation.textContent = result.explanation
      explanation.style.marginTop = '15px'
      explanation.style.padding = '15px'
      explanation.style.backgroundColor = '#f0f8ff'
      explanation.style.borderRadius = '10px'
      explanation.style.fontStyle = 'italic'

      // Find the question container and append explanation
      const questionContainer = document.querySelector('.question-container')
      if (questionContainer) {
        questionContainer.appendChild(explanation)
      } else {
        console.error('Question container not found')
      }
    }
  }

  async getNextQuestion () {
    try {
      const response = await fetch(
        `${this.apiBase}/api/quiz/${this.currentSession.sessionId}/next`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      if (result.completed) {
        this.showQuizResults(result)
      } else {
        this.currentSession.currentQuestion++
        this.displayCurrentQuestion()
      }
    } catch (error) {
      console.error('Error getting next question:', error)
      this.showError(`Failed to get next question: ${error.message}`)
    }
  }

  showQuizResults (result) {
    console.log('Quiz results data:', result)
    this.hideAllSections()
    document.getElementById('quiz-results').style.display = 'block'

    // Update score display
    document.getElementById('final-score').textContent = result.finalScore || 0
    document.getElementById('total-questions').textContent =
      result.totalQuestions || 0
    document.getElementById('score-percentage').textContent = `${
      result.percentage || 0
    }%`

    // Update results message
    const message = this.getResultsMessage(result.percentage)
    document.getElementById('results-message').textContent = message

    // Update time spent
    console.log('Time spent data:', result.timeSpent)
    let timeSpentText = 'Time taken: Unknown'

    if (result.timeSpent && typeof result.timeSpent === 'number') {
      const totalSeconds = Math.round(result.timeSpent / 1000)
      if (totalSeconds < 60) {
        timeSpentText = `Time taken: ${totalSeconds} seconds`
      } else {
        const minutes = Math.round(totalSeconds / 60)
        timeSpentText = `Time taken: ${minutes} minutes`
      }
    } else {
      // Fallback: calculate from start time if available
      if (this.currentSession && this.currentSession.startTime) {
        const now = Date.now()
        const totalSeconds = Math.round(
          (now - this.currentSession.startTime) / 1000
        )
        if (totalSeconds < 60) {
          timeSpentText = `Time taken: ${totalSeconds} seconds`
        } else {
          const minutes = Math.round(totalSeconds / 60)
          timeSpentText = `Time taken: ${minutes} minutes`
        }
      }
    }

    document.getElementById('time-spent').textContent = timeSpentText

    // Show detailed results
    this.showDetailedResults(result.answers)
  }

  getResultsMessage (percentage) {
    if (percentage >= 90) return "Outstanding! 🌟 You're a true expert!"
    if (percentage >= 80)
      return 'Excellent work! 🎉 You have a great understanding!'
    if (percentage >= 70) return "Good job! 👍 You're on the right track!"
    if (percentage >= 60) return 'Not bad! 📚 Keep studying to improve!'
    return "Keep practicing! 💪 You'll get better with more study!"
  }

  showDetailedResults (answers) {
    console.log('Detailed results answers:', answers)
    console.log('Current session:', this.currentSession)

    const container = document.getElementById('detailed-results')
    container.innerHTML = '<h3>Detailed Results</h3>'

    if (!answers || answers.length === 0) {
      container.innerHTML += '<p>No detailed results available.</p>'
      return
    }

    answers.forEach((answer, index) => {
      const resultItem = document.createElement('div')
      resultItem.className = `result-item ${
        answer.isCorrect ? 'correct' : 'incorrect'
      }`

      // Get question options safely
      const questionOptions = this.currentSession?.questions?.[index]
        ?.options || ['Option A', 'Option B', 'Option C', 'Option D']

      resultItem.innerHTML = `
                <h4>Question ${index + 1}</h4>
                <p><strong>Question:</strong> ${
                  answer.question || 'Question not available'
                }</p>
                <p><strong>Your Answer:</strong> ${answer.userAnswer + 1} - ${
        questionOptions[answer.userAnswer] || 'Answer not available'
      }</p>
                <p><strong>Correct Answer:</strong> ${
                  answer.correctAnswer + 1
                } - ${
        questionOptions[answer.correctAnswer] || 'Answer not available'
      }</p>
                <p class="explanation"><strong>Explanation:</strong> ${
                  answer.explanation || 'No explanation available'
                }</p>
            `

      container.appendChild(resultItem)
    })
  }

  updateProgress () {
    const progress =
      (this.currentSession.currentQuestion /
        this.currentSession.totalQuestions) *
      100
    document.getElementById('progress-fill').style.width = `${progress}%`
    document.getElementById(
      'progress-text'
    ).textContent = `Question ${this.currentSession.currentQuestion} of ${this.currentSession.totalQuestions}`
  }

  showQuizTaking () {
    this.hideAllSections()
    document.getElementById('quiz-taking').style.display = 'block'
  }

  showLoading () {
    this.hideAllSections()
    document.getElementById('loading').style.display = 'block'
  }

  showError (message) {
    this.hideAllSections()
    document.getElementById('error').style.display = 'block'
    document.getElementById('error-message').textContent = message
  }

  hideError () {
    document.getElementById('error').style.display = 'none'
  }

  hideAllSections () {
    document.getElementById('popular-topics').style.display = 'none'
    document.getElementById('quiz-setup').style.display = 'none'
    document.getElementById('quiz-taking').style.display = 'none'
    document.getElementById('quiz-results').style.display = 'none'
    document.getElementById('loading').style.display = 'none'
    document.getElementById('error').style.display = 'none'
  }

  resetQuiz () {
    this.currentSession = null
    this.currentQuestion = null
    this.selectedAnswer = null

    // Reset form
    document.getElementById('topic').value = ''
    document.getElementById('difficulty').value = 'medium'
    document.getElementById('question-count').value = '5'

    // Show popular topics and setup form
    this.hideAllSections()
    document.getElementById('popular-topics').style.display = 'block'
    document.getElementById('quiz-setup').style.display = 'block'
  }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new QuizApp()
})
