var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-cFEGQy/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/durable-objects/quiz-session.js
var QuizSession = class {
  static {
    __name(this, "QuizSession");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessionData = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    console.log(`QuizSession: ${request.method} ${path}`);
    try {
      if (path === "/internal/init" && request.method === "POST") {
        console.log("Initializing session...");
        return await this.initializeSession(request);
      }
      if (path === "/internal/status") {
        return await this.getSessionStatus();
      }
      if (path === "/internal/answer" && request.method === "POST") {
        return await this.submitAnswer(request);
      }
      if (path === "/internal/next" && request.method === "POST") {
        return await this.getNextQuestion();
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("QuizSession error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  async initializeSession(request) {
    try {
      console.log("Starting session initialization...");
      const data = await request.json();
      console.log("Received data:", {
        sessionId: data.sessionId,
        topic: data.topic
      });
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
      };
      console.log("Session data created, storing in KV...");
      await this.env.QUIZ_KV.put(
        `session:${data.sessionId}`,
        JSON.stringify(this.sessionData)
      );
      console.log("Session initialized successfully");
      return new Response(
        JSON.stringify({
          success: true,
          session: this.sessionData
        }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      console.error("Error in initializeSession:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  async getSessionStatus() {
    if (!this.sessionData) {
      await this.loadSessionFromKV();
      if (!this.sessionData) {
        return new Response(
          JSON.stringify({ error: "Session not initialized" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" }
          }
        );
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
            (this.sessionData.currentQuestionIndex + 1) / this.sessionData.totalQuestions * 100
          )
        }
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  async submitAnswer(request) {
    if (!this.sessionData) {
      await this.loadSessionFromKV();
      if (!this.sessionData) {
        return new Response(
          JSON.stringify({ error: "Session not initialized" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    if (this.sessionData.completed) {
      return new Response(JSON.stringify({ error: "Quiz already completed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const { answer } = await request.json();
    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      return new Response(JSON.stringify({ error: "No current question" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const isCorrect = answer === currentQuestion.correctAnswer;
    this.sessionData.answers.push({
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      userAnswer: answer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      explanation: currentQuestion.explanation,
      timestamp: Date.now()
    });
    if (isCorrect) {
      this.sessionData.score++;
    }
    await this.env.QUIZ_KV.put(
      `session:${this.sessionData.sessionId}`,
      JSON.stringify(this.sessionData)
    );
    return new Response(
      JSON.stringify({
        isCorrect,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        score: this.sessionData.score,
        totalAnswered: this.sessionData.answers.length,
        isLastQuestion: this.sessionData.currentQuestionIndex === this.sessionData.totalQuestions - 1
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  async getNextQuestion() {
    if (!this.sessionData) {
      await this.loadSessionFromKV();
      if (!this.sessionData) {
        return new Response(
          JSON.stringify({ error: "Session not initialized" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    if (this.sessionData.completed) {
      return new Response(
        JSON.stringify({
          error: "Quiz completed",
          finalScore: this.sessionData.score,
          totalQuestions: this.sessionData.totalQuestions,
          percentage: Math.round(
            this.sessionData.score / this.sessionData.totalQuestions * 100
          )
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    this.sessionData.currentQuestionIndex++;
    if (this.sessionData.currentQuestionIndex >= this.sessionData.totalQuestions) {
      this.sessionData.completed = true;
      this.sessionData.endTime = Date.now();
      await this.env.QUIZ_KV.put(
        `session:${this.sessionData.sessionId}`,
        JSON.stringify(this.sessionData)
      );
      return new Response(
        JSON.stringify({
          completed: true,
          finalScore: this.sessionData.score,
          totalQuestions: this.sessionData.totalQuestions,
          percentage: Math.round(
            this.sessionData.score / this.sessionData.totalQuestions * 100
          ),
          answers: this.sessionData.answers,
          timeSpent: this.sessionData.endTime - this.sessionData.startTime
        }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const nextQuestion = this.getCurrentQuestion();
    await this.env.QUIZ_KV.put(
      `session:${this.sessionData.sessionId}`,
      JSON.stringify(this.sessionData)
    );
    return new Response(
      JSON.stringify({
        question: nextQuestion,
        progress: {
          current: this.sessionData.currentQuestionIndex + 1,
          total: this.sessionData.totalQuestions,
          percentage: Math.round(
            (this.sessionData.currentQuestionIndex + 1) / this.sessionData.totalQuestions * 100
          )
        }
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  getCurrentQuestion() {
    if (!this.sessionData || this.sessionData.currentQuestionIndex >= this.sessionData.questions.length) {
      return null;
    }
    return this.sessionData.questions[this.sessionData.currentQuestionIndex];
  }
  async loadSessionFromKV() {
    try {
      const sessionId = this.state.id.name;
      if (sessionId) {
        const sessionDataStr = await this.env.QUIZ_KV.get(
          `session:${sessionId}`
        );
        if (sessionDataStr) {
          this.sessionData = JSON.parse(sessionDataStr);
        }
      }
    } catch (error) {
      console.error("Error loading session from KV:", error);
    }
  }
};

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (path === "/api/test-do" && request.method === "GET") {
        return await testDurableObject(env, corsHeaders);
      }
      if (path === "/api/popular-topics" && request.method === "GET") {
        return await getPopularTopics(env, corsHeaders);
      }
      if (path === "/api/generate-quiz" && request.method === "POST") {
        return await generateQuiz(request, env, corsHeaders);
      }
      if (path.startsWith("/api/quiz/") && request.method === "GET") {
        const sessionId = path.split("/")[3];
        return await getQuizSession(sessionId, env, corsHeaders);
      }
      if (path.startsWith("/api/quiz/") && path.endsWith("/answer") && request.method === "POST") {
        const sessionId = path.split("/")[3];
        return await submitAnswer(sessionId, request, env, corsHeaders);
      }
      if (path.startsWith("/api/quiz/") && path.endsWith("/next") && request.method === "POST") {
        const sessionId = path.split("/")[3];
        return await getNextQuestion(sessionId, env, corsHeaders);
      }
      return new Response("AI Quiz App API", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" }
      });
    } catch (error) {
      console.error("Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
async function getPopularTopics(env, corsHeaders) {
  try {
    const popularTopicsData = await env.QUIZ_KV.get("popular-topics");
    if (!popularTopicsData) {
      const defaultTopics = [
        { topic: "JavaScript", count: 0 },
        { topic: "Python", count: 0 },
        { topic: "React", count: 0 },
        { topic: "Node.js", count: 0 },
        { topic: "CSS", count: 0 },
        { topic: "HTML", count: 0 },
        { topic: "SQL", count: 0 },
        { topic: "Git", count: 0 },
        { topic: "Algorithms", count: 0 },
        { topic: "Data Structures", count: 0 }
      ];
      return new Response(JSON.stringify({ topics: defaultTopics }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const topics = JSON.parse(popularTopicsData);
    const sortedTopics = topics.sort((a, b) => b.count - a.count).slice(0, 10);
    return new Response(JSON.stringify({ topics: sortedTopics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error getting popular topics:", error);
    return new Response(JSON.stringify({ error: "Failed to get popular topics" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(getPopularTopics, "getPopularTopics");
async function testDurableObject(env, corsHeaders) {
  try {
    const testId = "test-session";
    const durableObjectId = env.QUIZ_SESSION.idFromName(testId);
    const quizSession = env.QUIZ_SESSION.get(durableObjectId);
    console.log("Testing Durable Object...");
    const response = await quizSession.fetch("http://internal/status");
    console.log("DO response status:", response.status);
    const result = await response.text();
    console.log("DO response:", result);
    return new Response(
      JSON.stringify({
        status: response.status,
        result,
        testId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("DO test error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(testDurableObject, "testDurableObject");
async function generateQuiz(request, env, corsHeaders) {
  const {
    topic,
    difficulty = "medium",
    questionCount = 5
  } = await request.json();
  if (!topic) {
    return new Response(JSON.stringify({ error: "Topic is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const quizData = await generateQuizWithAI(
      topic,
      difficulty,
      questionCount,
      env
    );
    const sessionId = crypto.randomUUID();
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
    };
    await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData));
    await trackTopicPopularity(topic, env);
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
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Quiz generation error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate quiz" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(generateQuiz, "generateQuiz");
async function trackTopicPopularity(topic, env) {
  try {
    const popularTopicsData = await env.QUIZ_KV.get("popular-topics");
    let topics = [];
    if (popularTopicsData) {
      topics = JSON.parse(popularTopicsData);
    }
    let existingTopic = topics.find((t) => t.topic.toLowerCase() === topic.toLowerCase());
    if (existingTopic) {
      existingTopic.count += 1;
      existingTopic.lastUsed = Date.now();
    } else {
      topics.push({
        topic,
        count: 1,
        lastUsed: Date.now()
      });
    }
    topics = topics.sort((a, b) => b.count - a.count).slice(0, 50);
    await env.QUIZ_KV.put("popular-topics", JSON.stringify(topics));
    console.log(`Tracked topic: ${topic}, count: ${existingTopic ? existingTopic.count : 1}`);
  } catch (error) {
    console.error("Error tracking topic popularity:", error);
  }
}
__name(trackTopicPopularity, "trackTopicPopularity");
async function generateQuizWithAI(topic, difficulty, questionCount, env) {
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
  
  Make sure the questions are educational and test understanding of the topic.`;
  const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 2e3,
    temperature: 0.7
  });
  try {
    const content = response.response;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No valid JSON found in AI response");
    }
  } catch (error) {
    console.error("Error parsing AI response:", error);
    return {
      questions: [
        {
          id: 1,
          question: `What is the main topic of "${topic}"?`,
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctAnswer: 0,
          explanation: "This is a sample question generated as a fallback."
        }
      ]
    };
  }
}
__name(generateQuizWithAI, "generateQuizWithAI");
async function getQuizSession(sessionId, env, corsHeaders) {
  try {
    const sessionDataStr = await env.QUIZ_KV.get(`session:${sessionId}`);
    if (!sessionDataStr) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const sessionData = JSON.parse(sessionDataStr);
    const currentQuestion = sessionData.questions[sessionData.currentQuestionIndex];
    return new Response(
      JSON.stringify({
        session: sessionData,
        currentQuestion,
        progress: {
          current: sessionData.currentQuestionIndex + 1,
          total: sessionData.totalQuestions,
          percentage: Math.round(
            (sessionData.currentQuestionIndex + 1) / sessionData.totalQuestions * 100
          )
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error getting quiz session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(getQuizSession, "getQuizSession");
async function submitAnswer(sessionId, request, env, corsHeaders) {
  try {
    const { answer } = await request.json();
    const sessionDataStr = await env.QUIZ_KV.get(`session:${sessionId}`);
    if (!sessionDataStr) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const sessionData = JSON.parse(sessionDataStr);
    if (sessionData.completed) {
      return new Response(JSON.stringify({ error: "Quiz already completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const currentQuestion = sessionData.questions[sessionData.currentQuestionIndex];
    if (!currentQuestion) {
      return new Response(JSON.stringify({ error: "No current question" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const isCorrect = answer === currentQuestion.correctAnswer;
    sessionData.answers.push({
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      userAnswer: answer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      explanation: currentQuestion.explanation,
      timestamp: Date.now()
    });
    if (isCorrect) {
      sessionData.score++;
    }
    await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData));
    return new Response(
      JSON.stringify({
        isCorrect,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        score: sessionData.score,
        totalAnswered: sessionData.answers.length,
        isLastQuestion: sessionData.currentQuestionIndex === sessionData.totalQuestions - 1
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error submitting answer:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(submitAnswer, "submitAnswer");
async function getNextQuestion(sessionId, env, corsHeaders) {
  try {
    const sessionDataStr = await env.QUIZ_KV.get(`session:${sessionId}`);
    if (!sessionDataStr) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const sessionData = JSON.parse(sessionDataStr);
    if (sessionData.completed) {
      return new Response(
        JSON.stringify({
          error: "Quiz completed",
          finalScore: sessionData.score,
          totalQuestions: sessionData.totalQuestions,
          percentage: Math.round(
            sessionData.score / sessionData.totalQuestions * 100
          )
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    sessionData.currentQuestionIndex++;
    if (sessionData.currentQuestionIndex >= sessionData.totalQuestions) {
      sessionData.completed = true;
      sessionData.endTime = Date.now();
      await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData));
      return new Response(
        JSON.stringify({
          completed: true,
          finalScore: sessionData.score,
          totalQuestions: sessionData.totalQuestions,
          percentage: Math.round(
            sessionData.score / sessionData.totalQuestions * 100
          ),
          answers: sessionData.answers,
          timeSpent: sessionData.endTime - sessionData.startTime
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const nextQuestion = sessionData.questions[sessionData.currentQuestionIndex];
    await env.QUIZ_KV.put(`session:${sessionId}`, JSON.stringify(sessionData));
    return new Response(
      JSON.stringify({
        question: nextQuestion,
        progress: {
          current: sessionData.currentQuestionIndex + 1,
          total: sessionData.totalQuestions,
          percentage: Math.round(
            (sessionData.currentQuestionIndex + 1) / sessionData.totalQuestions * 100
          )
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error getting next question:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(getNextQuestion, "getNextQuestion");

// C:/Users/ankit/AppData/Roaming/nvm/v21.7.3/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/ankit/AppData/Roaming/nvm/v21.7.3/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-cFEGQy/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/ankit/AppData/Roaming/nvm/v21.7.3/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-cFEGQy/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  QuizSession,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
