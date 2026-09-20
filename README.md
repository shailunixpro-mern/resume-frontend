# Resume Frontend

Interactive Next.js frontend for the resume portfolio, powered by the resume backend API.

## Quick Start

1. Install dependencies.
2. Create a `.env.local` file from `.env.example`.
3. Start the app.

```bash
npm install
npm run dev
```

Open the app using the URL printed by Next.js for your environment.

## Environment Variables

- `NEXT_PUBLIC_API_URL` Base URL for backend API. Example: `https://your-backend.example.com`
- `OPENAI_COMPATIBLE_BASE_URL` OpenAI-compatible API base URL. Example: `https://openrouter.ai/api/v1`
- `OPENAI_API_KEY` API key for your OpenAI-compatible provider
- `OPENAI_MODEL` Model name exposed by that provider. Example free-tier compatible value: `openai/gpt-oss-20b:free`

## Features

- Responsive and modern visual design.
- Interactive project filtering by technology.
- Graceful loading and retry on API failure.
- Aggregated API consumption for efficient first load.
- Simple AI processing box that sends text through a server-side Next route and logs prompt/response in the terminal.

## AI Processing Notes

- The new UI calls `POST /api/ai/process` inside this Next app.
- That route logs the prompt and model response to the Next.js terminal/server logs.
- The browser never receives the provider API key.
- OpenAI itself does not generally provide a free production API, so this integration is designed for any OpenAI-compatible provider, including free-tier compatible endpoints.

## Production Notes

- Build with `npm run build` and run with `npm run start`.
- `next.config.ts` uses standalone output for easier container and platform hosting.
- The app does not fall back to loopback backend URLs. `NEXT_PUBLIC_API_URL` must be set explicitly.
