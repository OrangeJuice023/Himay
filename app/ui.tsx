"use client";

import React from "react";
import Link from "next/link";

export const GITHUB_URL = "https://github.com/OrangeJuice023/Himay";

/* ---------------- Anthropic-inspired tokens ---------------- */
export const T = {
  bg: "#faf9f5",        // warm cream
  panel: "#f4f2ea",     // slightly deeper cream for section bands
  card: "#ffffff",
  ink: "#141413",       // near-black text
  sub: "#6b6862",       // muted body
  faint: "#b0aea5",     // mid gray
  line: "#e8e6dc",      // light gray borders
  accent: "#d97757",    // Anthropic clay/coral
  accentDark: "#c2603d",
  blue: "#6a9bcc",
  green: "#788c5d",
  red: "#b1492f",
};
export const SANS = "var(--font-sans)";
export const SERIF = "var(--font-serif)";
export const MONO = "var(--font-mono)";

/* ---------------- icons ---------------- */
export const ICONS: Record<string, string[]> = {
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  table: ["M3 3h18v18H3z", "M3 9h18", "M3 15h18", "M9 3v18"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  copy: ["M8 8h12v12H8z", "M16 8V4H4v12h4"],
  hash: ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"],
  type: ["M4 7V4h16v3", "M9 20h6", "M12 4v16"],
  spark: ["M12 3v3", "M12 18v3", "M5.6 5.6l2.1 2.1", "M16.3 16.3l2.1 2.1", "M3 12h3", "M18 12h3", "M5.6 18.4l2.1-2.1", "M16.3 7.7l2.1-2.1"],
  scan: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M7 12h10"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  gauge: ["M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M12 14l4-4", "M5 19a9 9 0 1 1 14 0"],
  doc: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13h6", "M9 17h4"],
  chart: ["M3 3v18h18", "M7 16l4-5 3 3 5-7"],
  check: ["M20 6 9 17l-5-5"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
};

export const Icon = ({ d, size = 18, color = T.accent }: { d: string[]; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);

/* ---------------- navbar ---------------- */
export function Navbar({ onUpload }: { onUpload?: () => void }) {
  const links = [
    { label: "Features", href: "/#features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "How To Use", href: "/how-to-use" },
    { label: "Contact", href: "/contact" },
    { label: "GitHub", href: GITHUB_URL },
  ];
  return (
    <header style={{
      borderBottom: `1px solid ${T.line}`, background: "rgba(250,249,245,0.85)",
      backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50,
    }}>
      <nav style={{
        maxWidth: 1100, margin: "0 auto", padding: "12px 20px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon d={ICONS.scan} size={22} />
          <span style={{ font: `600 19px ${SANS}`, color: T.ink, letterSpacing: "-0.3px" }}>Himay</span>
        </Link>
        <div className="himay-navlinks" style={{ display: "flex", gap: 22, marginLeft: 28 }}>
          {links.map((l) => (
            <Link key={l.label} href={l.href}
              style={{ font: `500 14px ${SANS}`, color: T.sub }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.ink)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.sub)}>
              {l.label}
            </Link>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          {onUpload ? (
            <button onClick={onUpload} style={primaryBtn}>Upload Dataset</button>
          ) : (
            <Link href="/" style={{ ...primaryBtn, display: "inline-block" }}>Upload Dataset</Link>
          )}
        </div>
      </nav>
      <style>{`@media (max-width: 760px){ .himay-navlinks{ display:none !important; } }`}</style>
    </header>
  );
}

export const primaryBtn: React.CSSProperties = {
  background: T.accent, color: "#fff", border: "none", borderRadius: 9,
  padding: "9px 18px", font: `600 14px ${SANS}`, cursor: "pointer",
  transition: "background 200ms",
};

export const Footer = () => (
  <footer style={{ borderTop: `1px solid ${T.line}`, marginTop: 8 }}>
    <div style={{
      maxWidth: 1100, margin: "0 auto", padding: "28px 20px",
      display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
      font: `400 13px ${SANS}`, color: T.sub,
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon d={ICONS.scan} size={16} color={T.faint} /> Himay — validate your data before you trust it
      </span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
        <Link href="/how-to-use" style={{ color: T.sub }}>How To Use</Link>
        <a href={GITHUB_URL} style={{ color: T.sub }}>GitHub</a>
      </span>
    </div>
  </footer>
);

/* ---------------- shared atoms ---------------- */
export const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, ...style }}>
    {children}
  </div>
);

export const Section = ({ icon, title, sub, children }: {
  icon: string; title: string; sub?: string; children: React.ReactNode;
}) => (
  <section style={{ marginBottom: 32 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
      <Icon d={ICONS[icon]} />
      <h2 style={{ font: `600 18px ${SANS}`, color: T.ink, margin: 0, letterSpacing: "-0.2px" }}>{title}</h2>
    </div>
    {sub && <p style={{ margin: "0 0 14px 28px", font: `400 14px ${SERIF}`, color: T.sub }}>{sub}</p>}
    {children}
  </section>
);
