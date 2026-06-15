import { NextRequest, NextResponse } from "next/server";

// POST /api/insight — body: { profile: <combined dataset + research profile> }
// Requires GROQ_API_KEY in env (free key from https://console.groq.com/keys).
export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });
  }

  const { profile } = await req.json();
  if (!profile) {
    return NextResponse.json({ error: "Missing profile." }, { status: 400 });
  }

  const prompt = `You are a senior data analyst and academic research consultant.

Analyze the dataset profile and provide a report with these sections, using markdown headings (###) for each:

1. Dataset Overview
2. Data Quality Assessment
3. Survey Integrity Issues
4. Research Risks
5. Recommended Cleaning Steps
6. Statistical Readiness Assessment

Write clearly for students and researchers who may not be statisticians. Be concise and practical — use short bullet points. If a section has no issues, say so briefly rather than inventing problems.

Dataset Profile:
${JSON.stringify(profile)}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1400,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `Groq request failed (${res.status}).`, detail }, { status: 502 });
  }

  const data = await res.json();
  const report: string = data.choices?.[0]?.message?.content ?? "";
  if (!report) {
    return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
  }

  return NextResponse.json({ report });
}
