import { NextRequest, NextResponse } from "next/server";

// POST /api/insight — body: { profile: <compact dataset profile> }
// Requires GROQ_API_KEY in env (free key from https://console.groq.com).
export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const { profile } = await req.json();
  if (!profile) {
    return NextResponse.json({ error: "Missing profile." }, { status: 400 });
  }

  const prompt = `You are a senior data analyst.

Analyze the following dataset profile.

Provide:
1. Executive Summary
2. Key Data Quality Issues
3. Potential Risks
4. Recommended Cleaning Steps

Keep the report professional and concise. Use markdown headings (###) for each section and short bullet points.

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
      max_tokens: 1024,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: `Groq request failed (${res.status}).`, detail },
      { status: 502 }
    );
  }

  const data = await res.json();
  const report: string = data.choices?.[0]?.message?.content ?? "";
  if (!report) {
    return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
  }

  return NextResponse.json({ report });
}
