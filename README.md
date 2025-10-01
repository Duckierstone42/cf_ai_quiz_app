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

## Prerequisites

Before deploying, you'll need:

1. **Cloudflare Account** with Workers AI access
2. **API Tokens**:
   - Workers AI API Token
   - Cloudflare Account Token (with Workers, KV, and Durable Objects permissions)
3. **Wrangler CLI** installed globally

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Cloudflare Services

#### Create KV Namespace

```bash
wrangler kv:namespace create "QUIZ_KV"
```

Copy the namespace ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "QUIZ_KV"
id = "your_actual_namespace_id_here"
```

#### Get Workers AI API Token

1. Go to [Cloudflare Dashboard → Workers AI](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
2. Click "Use REST API"
3. Create a Workers AI API Token
4. Note the token for environment variables

### 3. Set Environment Variables

Create a `.dev.vars` file for local development:

```bash
# .dev.vars
WORKERS_AI_API_TOKEN=your_workers_ai_token_here
```

For production, set environment variables in Cloudflare Dashboard:

```bash
wrangler secret put WORKERS_AI_API_TOKEN
```

### 4. Update API Base URL

In `frontend/script.js`, update the `setApiBase()` method with your actual Worker URL after deployment.

## Deployment

### 1. Deploy the Worker

```bash
# Deploy to production
wrangler deploy

# Or deploy to a custom domain
wrangler deploy --compatibility-date 2024-01-15
```

### 2. Deploy the Frontend (Pages)

```bash
# Deploy to Cloudflare Pages
wrangler pages deploy ./frontend

# Or connect your GitHub repository for automatic deployments
```

### 3. Update Frontend Configuration

After deployment, update the API base URL in your frontend:

1. Get your Worker URL from the deployment output
2. Update `frontend/script.js` in the `setApiBase()` method
3. Redeploy the frontend

## API Endpoints

### Generate Quiz

```
POST /api/generate-quiz
{
  "topic": "JavaScript",
  "difficulty": "medium",
  "questionCount": 5
}
```

### Get Quiz Session

```
GET /api/quiz/{sessionId}
```

### Submit Answer

```
POST /api/quiz/{sessionId}/answer
{
  "answer": 0
}
```

### Get Next Question

```
POST /api/quiz/{sessionId}/next
```

## Project Structure

```
ai-quiz-app/
├── src/
│   ├── index.js                 # Main Worker entry point
│   └── durable-objects/
│       └── quiz-session.js       # Durable Object for quiz sessions
├── frontend/
│   ├── index.html               # Main HTML page
│   ├── styles.css               # Styling
│   └── script.js                # Frontend JavaScript
├── wrangler.toml                # Wrangler configuration
├── package.json                 # Dependencies
└── README.md                    # This file
```

## Development

### Local Development

```bash
# Start local development server
wrangler dev

# Start Pages development server
wrangler pages dev ./frontend
```

### Testing

1. Start the Worker locally: `wrangler dev`
2. Start the frontend locally: `wrangler pages dev ./frontend`
3. Update the API base URL in `script.js` to `http://localhost:8787`
4. Test the full application flow

## Configuration

### wrangler.toml

Key configuration options:

- `name`: Your Worker name
- `main`: Entry point file
- `compatibility_date`: Cloudflare compatibility date
- `[ai]`: Workers AI binding
- `[[kv_namespaces]]`: KV namespace bindings
- `[durable_objects]`: Durable Object bindings

### Environment Variables

Required environment variables:

- `WORKERS_AI_API_TOKEN`: Your Workers AI API token
