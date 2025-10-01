# AI Quiz Generator 🧠

An AI-powered quiz generating application built on Cloudflare's platform using Workers AI, Durable Objects, and Pages.

## Features

- **AI-Powered Question Generation**: Uses Llama 3.3 via Cloudflare Workers AI to generate intelligent quiz questions
- **Interactive Quiz Interface**: Beautiful, responsive web interface for taking quizzes
- **Session Management**: Durable Objects handle quiz sessions with persistent state
- **Progress Tracking**: Real-time progress tracking and scoring
- **Detailed Results**: Comprehensive feedback with explanations for each answer
- **Customizable**: Choose topic, difficulty level, and number of questions

## Architecture

### Components

1. **LLM**: Llama 3.3 via Cloudflare Workers AI for generating quiz questions
2. **Workflow/Coordination**: Cloudflare Workers handle API endpoints and Durable Objects manage quiz sessions
3. **User Input**: Cloudflare Pages frontend with interactive quiz interface
4. **Memory/State**: Workers KV stores quiz data and Durable Objects maintain session state

### Tech Stack

- **Backend**: Cloudflare Workers
- **AI**: Llama 3.3 via Workers AI
- **State Management**: Durable Objects + Workers KV
- **Frontend**: HTML, CSS, JavaScript (Cloudflare Pages)
- **Deployment**: Wrangler CLI

# Access

This AI application has been deployed on cloudflare pages here: https://266705d4.ai-quiz-generator.pages.dev/
