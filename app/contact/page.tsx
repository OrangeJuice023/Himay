"use client";

import { useState } from "react";
import { T, SANS, SERIF, MONO, Icon, ICONS, Navbar, Footer, Card, primaryBtn } from "../ui";

const MAX = { name: 80, email: 120, message: 2000 };
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const field: React.CSSProperties = {
  width: "100%", font: `400 15px ${SERIF}`, color: T.ink, background: T.card,
  border: `1px solid ${T.line}`, borderRadius: 10, padding: "11px 13px", outline: "none",
};
const label: React.CSSProperties = { font: `600 13px ${SANS}`, color: T.ink, display: "block", marginBottom: 6 };

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  const valid = name.trim() && message.trim() && isEmail(email.trim());

  const submit = async () => {
    setErr(null);
    if (!valid) { setErr("Please fill in your name, a valid email, and a message."); return; }
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, company }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("sent"); setName(""); setEmail(""); setMessage("");
    } catch (e) {
      setStatus("error");
      setErr(e instanceof Error && e.message !== "Failed" ? e.message : "Could not send your message. Please try again.");
    }
  };

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "48px 20px 64px" }}>
        <p style={{ font: `600 13px ${SANS}`, color: T.accent, letterSpacing: "0.4px", textTransform: "uppercase", margin: 0 }}>
          Contact
        </p>
        <h1 style={{ font: `700 clamp(28px, 5vw, 40px) ${SANS}`, color: T.ink, letterSpacing: "-1px", margin: "8px 0 12px" }}>
          Suggest a feature or say hello
        </h1>
        <p style={{ font: `400 16px/1.6 ${SERIF}`, color: T.sub, marginBottom: 32 }}>
          Found a bug, want a new check, or have a dataset Himay struggled with? Send it over —
          feedback shapes what gets built next.
        </p>

        {status === "sent" ? (
          <Card style={{ display: "flex", gap: 12, alignItems: "flex-start", borderColor: T.green }}>
            <Icon d={ICONS.check} size={20} color={T.green} />
            <div>
              <div style={{ font: `600 16px ${SANS}`, color: T.ink }}>Message sent</div>
              <p style={{ font: `400 15px/1.6 ${SERIF}`, color: T.sub, margin: "4px 0 0" }}>
                Thanks for the feedback — it came through. You can close this page.
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={label} htmlFor="c-name">Name</label>
                <input id="c-name" style={field} value={name} maxLength={MAX.name}
                  onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </div>
              <div>
                <label style={label} htmlFor="c-email">Email</label>
                <input id="c-email" style={field} value={email} maxLength={MAX.email} type="email"
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div>
                <label style={label} htmlFor="c-msg">Message</label>
                <textarea id="c-msg" style={{ ...field, minHeight: 130, resize: "vertical" }} value={message}
                  maxLength={MAX.message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="What would make Himay more useful for you?" />
                <div style={{ font: `400 11px ${MONO}`, color: T.faint, textAlign: "right", marginTop: 4 }}>
                  {message.length}/{MAX.message}
                </div>
              </div>

              {/* honeypot — hidden from humans, off-screen and untabbable */}
              <input value={company} onChange={(e) => setCompany(e.target.value)}
                name="company" tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

              {err && <p style={{ font: `400 13px ${SANS}`, color: T.red, margin: 0 }}>{err}</p>}

              <button onClick={submit} disabled={status === "sending" || !valid}
                style={{ ...primaryBtn, padding: "12px 24px", fontSize: 15, justifySelf: "start",
                  opacity: status === "sending" || !valid ? 0.6 : 1,
                  cursor: status === "sending" || !valid ? "default" : "pointer" }}>
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
            </div>
          </Card>
        )}

        <p style={{ font: `400 12px ${SANS}`, color: T.faint, marginTop: 16 }}>
          Your message is sent securely through Himay&apos;s server — your email is used only to reply.
        </p>
      </main>
      <Footer />
    </>
  );
}
