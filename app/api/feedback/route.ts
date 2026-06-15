import { NextRequest, NextResponse } from "next/server";

/*
 * POST /api/feedback  — sends a feature suggestion / contact message via Resend.
 *
 * Security model:
 *  - RESEND_API_KEY is read from the server environment only. It is never sent
 *    to the browser, and no value submitted in the form can reach or alter it.
 *  - All user input is length-capped, type-checked, and HTML-escaped before it
 *    is placed in the email body (prevents HTML/script injection).
 *  - Newlines are stripped from any header-bound value (prevents email header
 *    injection, e.g. forging extra To:/Bcc: headers).
 *  - A hidden honeypot field traps bots; a per-IP in-memory rate limit throttles
 *    abuse so the Resend quota can't be drained by hammering the endpoint.
 *  - Internal errors are never reflected to the client.
 */

const TO = process.env.CONTACT_TO || "gervicorado@yahoo.com";
const FROM = process.env.RESEND_FROM || "Himay Contact <onboarding@resend.dev>";

const MAX = { name: 80, email: 120, message: 2000, body: 8000 };

// crude per-instance rate limit (best-effort on serverless): 3 / 10 min / IP
const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 3, windowMs = 600_000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  return false;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// strip CR/LF (and trim) for anything that could land in an email header
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= MAX.email;

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Contact form is not configured." }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
  }

  // guard payload size before parsing
  const raw = await req.text();
  if (raw.length > MAX.body) {
    return NextResponse.json({ error: "Message is too long." }, { status: 413 });
  }

  let data: unknown;
  try { data = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const b = (data ?? {}) as Record<string, unknown>;

  // honeypot: real users never fill this; bots often do -> pretend success
  if (typeof b.company === "string" && b.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = typeof b.name === "string" ? b.name.trim().slice(0, MAX.name) : "";
  const email = typeof b.email === "string" ? b.email.trim().slice(0, MAX.email) : "";
  const message = typeof b.message === "string" ? b.message.trim().slice(0, MAX.message) : "";

  if (!name || !message) {
    return NextResponse.json({ error: "Please include your name and a message." }, { status: 400 });
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const safeName = escapeHtml(oneLine(name));
  const safeEmail = oneLine(email);          // already validated to a strict pattern
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  const payload = {
    from: FROM,
    to: [TO],
    reply_to: safeEmail,
    subject: oneLine(`Himay feedback from ${name}`).slice(0, 120),
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#141413">
      <p><strong>From:</strong> ${safeName} &lt;${escapeHtml(safeEmail)}&gt;</p>
      <hr style="border:none;border-top:1px solid #e8e6dc" />
      <p>${safeMessage}</p>
    </div>`,
    text: `From: ${oneLine(name)} <${safeEmail}>\n\n${message}`,
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
      return NextResponse.json({ error: "Could not send your message right now." }, { status: 502 });
    }
  } catch (e) {
    console.error("Resend request failed:", e);
    return NextResponse.json({ error: "Could not send your message right now." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
