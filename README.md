# TestForge AI

An evidence-grounded API test generation and evaluation MVP built with Next.js, TypeScript, Tailwind CSS, Recharts, and Zod.

## Run locally

```bash
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local (server only)
npm run dev
```

Open `http://localhost:3000`. The app opens in Claude AI mode. Add your Anthropic API key to `ANTHROPIC_API_KEY` in `.env.local`, then restart the dev server. It defaults to Claude Haiku 5.5; `ANTHROPIC_MODEL` can select another model available to your Anthropic API account. The key is read only on the server and is never sent to the browser. Demo mode remains available from the mode toggle and uses clearly labeled sample data.

Live generation calls Anthropic's Messages API and validates the returned JSON with Zod. If the provider is unavailable, unconfigured, or returns invalid output, the UI keeps the current results and displays an error.
# promptEnggProject
