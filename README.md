# Himay

**Himayin ang datos bago ito pagkatiwalaan.** — Dissect your data before you trust it.

AI-powered data profiling: upload a CSV and instantly see structure, quality score, missing values, duplicates, schema, statistics, distributions, outliers, and an AI-generated analyst report. All profiling runs client-side — no database, no upload to a server.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Recharts · PapaParse · Groq (Llama 3.3 70B) for AI insights.

## Run locally

```bash
npm install
cp .env.example .env.local   # add your free Groq key from console.groq.com/keys
npm run dev
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo at vercel.com — Next.js is auto-detected, no config needed.
3. In Project → Settings → Environment Variables, add `GROQ_API_KEY`.
4. Deploy.

The Groq key lives only in the server-side API route (`app/api/insight/route.ts`) and is never exposed to the browser.

## How the Himay Score works

`score = 100 − 1.2·missing% − 1.5·duplicate% − 0.8·min(avgOutlier%, 15)`, clamped to 0. Grades: 95–100 Excellent, 80–94 Good, 60–79 Fair, <60 Needs Attention.
