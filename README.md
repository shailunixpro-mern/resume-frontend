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

Open `http://localhost:3000`.

## Environment Variables

- `NEXT_PUBLIC_API_URL` Base URL for backend API. Example: `http://localhost:5000`

## Features

- Responsive and modern visual design.
- Interactive project filtering by technology.
- Graceful loading and retry on API failure.
- Aggregated API consumption for efficient first load.

## Production Notes

- Build with `npm run build` and run with `npm run start`.
- `next.config.ts` uses standalone output for easier container and platform hosting.
