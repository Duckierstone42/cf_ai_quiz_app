# Deployment Guide 🚀

This guide will walk you through deploying your AI Quiz Generator app to Cloudflare.

## Prerequisites Checklist

Before starting deployment, ensure you have:

- [ ] Cloudflare account with Workers AI access
- [ ] Workers AI API token
- [ ] Cloudflare account token with required permissions
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Node.js and npm installed

## Step-by-Step Deployment

### Step 1: Authenticate with Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Step 2: Create KV Namespace

```bash
wrangler kv:namespace create "QUIZ_KV"
```

**Important**: Copy the namespace ID from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "QUIZ_KV"
id = "your_actual_namespace_id_here"  # Replace this!
```

### Step 3: Set Environment Variables

#### For Production:

```bash
wrangler secret put WORKERS_AI_API_TOKEN
```

Enter your Workers AI API token when prompted.

#### For Local Development:

Create a `.dev.vars` file:

```bash
# .dev.vars
WORKERS_AI_API_TOKEN=your_workers_ai_token_here
```

### Step 4: Deploy the Worker

```bash
wrangler deploy
```

**Note the Worker URL** from the output - you'll need this for the frontend!

### Step 5: Update Frontend Configuration

Edit `frontend/script.js` and update the `setApiBase()` method:

```javascript
setApiBase() {
    if (window.location.hostname === 'localhost') {
        this.apiBase = 'http://localhost:8787';
    } else {
        // Replace with your actual Worker URL
        this.apiBase = 'https://ai-quiz-app.your-subdomain.workers.dev';
    }
}
```

### Step 6: Deploy the Frontend

#### Option A: Deploy via Wrangler

```bash
wrangler pages deploy ./frontend
```

#### Option B: Connect GitHub Repository

1. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/pages)
2. Click "Create a project"
3. Connect your GitHub repository
4. Set build command: (leave empty)
5. Set build output directory: `frontend`
6. Deploy

### Step 7: Test Your Deployment

1. Visit your Pages URL
2. Create a test quiz
3. Verify all functionality works

## Configuration Files

### wrangler.toml

```toml
name = "ai-quiz-app"
main = "src/index.js"
compatibility_date = "2024-01-15"

[ai]
binding = "AI"

[[kv_namespaces]]
binding = "QUIZ_KV"
id = "your_kv_namespace_id"

[durable_objects]
bindings = [
  { name = "QUIZ_SESSION", class_name = "QuizSession" }
]

[vars]
ENVIRONMENT = "production"
```

### package.json

```json
{
  "name": "ai-quiz-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "pages:dev": "wrangler pages dev ./frontend",
    "pages:deploy": "wrangler pages deploy ./frontend"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

## Environment Variables

### Required Secrets

- `WORKERS_AI_API_TOKEN`: Your Workers AI API token

### Optional Variables

- `ENVIRONMENT`: Set to "production" for production deployments

## Troubleshooting Deployment

### Common Issues

#### 1. KV Namespace Not Found

```
Error: KV namespace not found
```

**Solution**: Ensure you've created the KV namespace and updated the ID in `wrangler.toml`

#### 2. Workers AI Access Denied

```
Error: Workers AI access denied
```

**Solution**:

- Verify your Workers AI API token
- Check token permissions in Cloudflare Dashboard
- Ensure Workers AI is enabled for your account

#### 3. Durable Object Binding Error

```
Error: Durable Object binding not found
```

**Solution**:

- Verify the class name matches the binding in `wrangler.toml`
- Ensure the Durable Object class is properly exported

#### 4. CORS Issues

```
Error: CORS policy blocks request
```

**Solution**:

- Check CORS headers in `src/index.js`
- Verify API base URL in frontend configuration

### Debug Commands

```bash
# Check deployment status
wrangler deployments list

# View Worker logs
wrangler tail

# Test locally
wrangler dev

# Check KV namespace
wrangler kv:namespace list
```

## Post-Deployment Checklist

- [ ] Worker deployed successfully
- [ ] Frontend deployed to Pages
- [ ] API base URL updated in frontend
- [ ] KV namespace configured
- [ ] Environment variables set
- [ ] Test quiz generation works
- [ ] Test quiz taking works
- [ ] Test quiz results display
- [ ] Check browser console for errors

## Monitoring and Maintenance

### View Logs

```bash
wrangler tail --format=pretty
```

### Update Deployment

```bash
# Update Worker
wrangler deploy

# Update Frontend
wrangler pages deploy ./frontend
```

### Monitor Usage

- Check Cloudflare Dashboard → Workers → Analytics
- Monitor KV usage in Dashboard → Workers KV
- Track Pages analytics in Dashboard → Pages

## Security Considerations

1. **API Tokens**: Never commit API tokens to version control
2. **CORS**: Configure CORS headers appropriately for production
3. **Rate Limiting**: Consider implementing rate limiting for API endpoints
4. **Input Validation**: Validate all user inputs on both frontend and backend

## Performance Optimization

1. **KV Caching**: Use KV for caching frequently accessed data
2. **Durable Object Optimization**: Minimize state updates
3. **Frontend Optimization**: Optimize images and assets
4. **CDN**: Leverage Cloudflare's global CDN

## Backup and Recovery

### KV Data Backup

```bash
# List all KV keys
wrangler kv:key list --namespace-id=your_namespace_id

# Get specific key value
wrangler kv:key get "session:session_id" --namespace-id=your_namespace_id
```

### Configuration Backup

- Keep `wrangler.toml` in version control
- Document environment variables
- Save deployment scripts

---

## Need Help?

If you encounter issues during deployment:

1. Check the troubleshooting section above
2. Review Cloudflare documentation
3. Check Worker logs: `wrangler tail`
4. Verify all configuration files
5. Test locally first: `wrangler dev`

Happy deploying! 🎉
