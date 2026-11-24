# TestForge AI

An evidence-grounded API test generation and evaluation MVP built with Next.js, TypeScript, Tailwind CSS, Recharts, and Zod.

## Run locally

```bash
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local (server only)
npm run dev
```

Open `http://localhost:3000`. Demo mode is enabled by default and uses clearly labeled sample data. Switch to Live AI to call the server-side `/api/generate` route. The API key is read only on the server and is never sent to the browser. `OPENAI_MODEL` can optionally select a compatible OpenAI chat-completions model.

Live generation validates the returned JSON with Zod. If the provider is unavailable, unconfigured, or returns invalid output, the UI keeps the current results and displays an error.
# promptEnggProject
