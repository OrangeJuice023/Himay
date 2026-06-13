"use client";

import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import {
  profileDataset, profileForAI, type DatasetProfile, type Row,
} from "@/lib/profile";

/* ---------------- design tokens ---------------- */
const T = {
  accent: "#0F766E", ink: "#134E4A", text: "#1C1917", sub: "#78716C",
  bg: "#FAFAF9", card: "#FFFFFF", line: "#E7E5E4",
  amber: "#D97706", red: "#DC2626", green: "#059669",
};
const FONT = "var(--font-sans)";
const MONO = "var(--font-mono)";

/* ---------------- small UI atoms ---------------- */
const Icon = ({ d, size = 18, color = T.accent }: { d: string[]; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const ICONS: Record<string, string[]> = {
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  table: ["M3 3h18v18H3z", "M3 9h18", "M3 15h18", "M9 3v18"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  copy: ["M8 8h12v12H8z", "M16 8V4H4v12h4"],
  hash: ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"],
  type: ["M4 7V4h16v3", "M9 20h6", "M12 4v16"],
  spark: ["M12 3v3", "M12 18v3", "M5.6 5.6l2.1 2.1", "M16.3 16.3l2.1 2.1", "M3 12h3", "M18 12h3", "M5.6 18.4l2.1-2.1", "M16.3 7.7l2.1-2.1"],
  scan: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M7 12h10"],
};

const Section = ({ icon, title, sub, children }: {
  icon: string; title: string; sub?: string; children: React.ReactNode;
}) => (
  <section style={{ marginBottom: 28 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <Icon d={ICONS[icon]} />
      <h2 style={{ font: `600 16px ${FONT}`, color: T.ink, margin: 0 }}>{title}</h2>
    </div>
    {sub && <p style={{ margin: "0 0 12px 26px", font: `400 13px ${FONT}`, color: T.sub }}>{sub}</p>}
    {children}
  </section>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.line}`, borderRadius: 10,
    padding: 16, ...style,
  }}>{children}</div>
);

const fmt = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Number(v.toFixed(2)).toString();
};

const riskColor = (pct: number) => (pct >= 20 ? T.red : pct >= 5 ? T.amber : T.green);
const riskLabel = (pct: number) => (pct >= 20 ? "High risk" : pct >= 5 ? "Medium risk" : "Low risk");

/* ---------------- gauge ---------------- */
function Gauge({ score, grade }: { score: number; grade: string }) {
  const color = score >= 80 ? T.accent : score >= 60 ? T.amber : T.red;
  const r = 64, c = 2 * Math.PI * r, filled = (score / 100) * c;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width="160" height="160" role="img" aria-label={`Himay Score ${score} of 100`}>
        <circle cx="80" cy="80" r={r} fill="none" stroke={T.line} strokeWidth="12" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 80 80)"
          style={{ transition: "stroke-dasharray 900ms ease" }} />
        <text x="80" y="76" textAnchor="middle" style={{ font: `700 34px ${MONO}`, fill: T.text }}>{score}</text>
        <text x="80" y="98" textAnchor="middle" style={{ font: `500 12px ${FONT}`, fill: T.sub }}>/ 100</text>
      </svg>
      <div>
        <div style={{ font: `700 22px ${FONT}`, color }}>{grade}</div>
        <p style={{ font: `400 14px ${FONT}`, color: T.sub, maxWidth: 380, marginTop: 6 }}>
          {score >= 95 ? "Your dataset is highly reliable and ready for analysis."
            : score >= 80 ? "Your dataset is generally reliable but contains moderate quality issues."
            : score >= 60 ? "Your dataset has notable quality issues — review before trusting results."
            : "Your dataset needs attention. Significant cleaning is recommended before analysis."}
        </p>
      </div>
    </div>
  );
}

/* ---------------- AI report ---------------- */
function AIReport({ profile }: { profile: DatasetProfile }) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: profileForAI(profile) }),
      });
      const data = await res.json();
      if (!res.ok || !data.report) throw new Error(data.error || "Empty response");
      setReport(data.report);
    } catch {
      setError("Could not generate the report. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <Card>
      {!report && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <p style={{ font: `400 14px ${FONT}`, color: T.sub, marginBottom: 14 }}>
            Generate a concise analyst report — executive summary, key issues, risks, and recommended cleaning steps.
          </p>
          <button onClick={generate} disabled={loading} style={{
            background: T.accent, color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 22px", font: `600 14px ${FONT}`, cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1, transition: "opacity 200ms",
          }}>
            {loading ? "Analyzing…" : "Generate AI Report"}
          </button>
          {error && <p style={{ color: T.red, font: `400 13px ${FONT}`, marginTop: 10 }}>{error}</p>}
        </div>
      )}
      {report && (
        <div style={{ font: `400 14px/1.65 ${FONT}`, color: T.text }}>
          {report.split("\n").map((line, i) => {
            const t = line.trim();
            if (t.startsWith("###")) return <h3 key={i} style={{ font: `600 15px ${FONT}`, color: T.ink, margin: "16px 0 6px" }}>{t.replace(/^#+\s*/, "")}</h3>;
            if (/^[-*]\s/.test(t)) return <div key={i} style={{ display: "flex", gap: 8, margin: "3px 0" }}><span style={{ color: T.accent }}>•</span><span>{t.replace(/^[-*]\s/, "").replace(/\*\*/g, "")}</span></div>;
            if (t) return <p key={i} style={{ margin: "6px 0" }}>{t.replace(/\*\*/g, "")}</p>;
            return null;
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------------- main page ---------------- */
export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [distCol, setDistCol] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const profile = useMemo(
    () => (rows && rows.length ? profileDataset(rows, fields) : null),
    [rows, fields]
  );

  const handleFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { setParseError("Please upload a CSV file."); return; }
    setParseError(null);
    Papa.parse<Row>(f, {
      header: true, skipEmptyLines: "greedy",
      complete: (res) => {
        if (!res.data.length || !res.meta.fields?.length) {
          setParseError("The file appears to be empty or has no header row.");
          return;
        }
        setFile(f); setRows(res.data); setFields(res.meta.fields); setDistCol(null);
      },
      error: () => setParseError("Could not parse this file."),
    });
  };

  const selectedDist = profile ? (distCol ?? profile.columns[0]?.name) : null;
  const distData = useMemo(() => {
    if (!profile || !selectedDist) return null;
    const col = profile.columns.find((c) => c.name === selectedDist);
    if (!col) return null;
    if (col.type === "Numeric" && col.stats) {
      const { min, max, values } = col.stats;
      const bins = 10, w = (max - min) / bins || 1;
      const counts = Array.from({ length: bins }, () => 0);
      values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v - min) / w))]++);
      return {
        kind: "histogram" as const,
        data: counts.map((count, i) => ({ label: `${fmt(min + i * w)}–${fmt(min + (i + 1) * w)}`, count })),
      };
    }
    return {
      kind: "frequency" as const,
      data: (col.topValues || []).map(([label, count]) => ({ label, count })),
    };
  }, [profile, selectedDist]);

  const reset = () => { setFile(null); setRows(null); setFields([]); setDistCol(null); };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: FONT }}>
      <style>{`.himay-card:hover { box-shadow: 0 2px 10px rgba(28,25,23,.06); }`}</style>

      {/* header */}
      <header style={{
        borderBottom: `1px solid ${T.line}`, background: T.card,
        padding: "14px 24px", display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Icon d={ICONS.scan} size={22} />
        <span style={{ font: `700 18px ${FONT}`, color: T.ink, letterSpacing: "-0.3px" }}>Himay</span>
        <span style={{ font: `400 12px ${FONT}`, color: T.sub, marginLeft: 4 }}>data profiling</span>
        {profile && (
          <button onClick={reset} style={{
            marginLeft: "auto", background: "transparent", border: `1px solid ${T.line}`,
            borderRadius: 8, padding: "6px 14px", font: `500 13px ${FONT}`, color: T.ink,
            transition: "border-color 200ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.accent)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.line)}>
            New dataset
          </button>
        )}
      </header>

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 20px 64px" }}>
        {/* ---------- landing / upload ---------- */}
        {!profile && (
          <div style={{ textAlign: "center", paddingTop: 48 }}>
            <h1 style={{ font: `700 clamp(26px, 4.5vw, 40px) ${FONT}`, color: T.ink, letterSpacing: "-0.8px", margin: 0 }}>
              Himayin ang datos bago ito pagkatiwalaan.
            </h1>
            <p style={{ font: `400 16px ${FONT}`, color: T.sub, margin: "14px auto 36px", maxWidth: 520 }}>
              Upload a CSV file and instantly uncover quality issues, anomalies, and insights — all profiled privately in your browser.
            </p>

            <div
              role="button" tabIndex={0} aria-label="Upload CSV dataset"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              style={{
                maxWidth: 520, margin: "0 auto", padding: "44px 24px",
                border: `2px dashed ${dragOver ? T.accent : T.line}`,
                background: dragOver ? "#F0FDFA" : T.card,
                borderRadius: 14, cursor: "pointer", transition: "all 200ms",
              }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <Icon d={ICONS.upload} size={32} />
              </div>
              <div style={{ font: `600 15px ${FONT}`, color: T.ink }}>Upload Dataset</div>
              <div style={{ font: `400 13px ${FONT}`, color: T.sub, marginTop: 6 }}>
                Drag &amp; drop a .csv file here, or click to browse
              </div>
            </div>
            <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])} />
            {parseError && <p style={{ color: T.red, font: `400 14px ${FONT}`, marginTop: 16 }}>{parseError}</p>}
          </div>
        )}

        {/* ---------- results ---------- */}
        {profile && file && rows && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <h1 style={{ font: `700 22px ${FONT}`, color: T.ink, margin: 0, letterSpacing: "-0.4px" }}>{file.name}</h1>
              <span style={{ font: `500 13px ${MONO}`, color: T.sub }}>
                {(file.size / 1024).toFixed(1)} KB · {profile.rows.toLocaleString()} rows · {profile.cols} columns
              </span>
            </div>

            <Section icon="table" title="Dataset Overview">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                {([
                  ["Total Rows", profile.rows.toLocaleString()],
                  ["Total Columns", profile.cols],
                  ["Missing Values", `${profile.totalMissing.toLocaleString()} (${profile.missingPct.toFixed(1)}%)`],
                  ["Duplicate Rows", profile.duplicates.toLocaleString()],
                  ["Numeric Columns", profile.numericCount],
                  ["Text Columns", profile.textCount],
                ] as [string, string | number][]).map(([label, value]) => (
                  <Card key={label} style={{ transition: "box-shadow 200ms" }}>
                    <div className="himay-card">
                      <div style={{ font: `500 12px ${FONT}`, color: T.sub, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
                      <div style={{ font: `700 20px ${MONO}`, color: T.ink, marginTop: 6 }}>{value}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>

            <Section icon="spark" title="Himay Score" sub="Composite quality score based on missingness, duplicates, and outliers.">
              <Card><Gauge score={profile.score} grade={profile.grade} /></Card>
            </Section>

            <Section icon="alert" title="Missing Value Analysis">
              <Card>
                <div style={{ height: Math.max(120, profile.columns.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profile.columns.map((c) => ({ name: c.name, pct: +c.missingPct.toFixed(1) }))}
                      layout="vertical" margin={{ left: 8, right: 36 }}>
                      <CartesianGrid horizontal={false} stroke={T.line} />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: T.sub }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: T.text }} />
                      <Tooltip formatter={(v) => [`${v}% missing`, riskLabel(Number(v))]} cursor={{ fill: "#F5F5F4" }} />
                      <Bar dataKey="pct" radius={[0, 4, 4, 0]} background={{ fill: "#F5F5F4" }}>
                        {profile.columns.map((c) => <Cell key={c.name} fill={riskColor(c.missingPct)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, font: `400 12px ${FONT}`, color: T.sub }}>
                  {([[T.green, "Low risk (<5%)"], [T.amber, "Medium (5–20%)"], [T.red, "High (≥20%)"]] as [string, string][]).map(([c, l]) => (
                    <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                    </span>
                  ))}
                </div>
              </Card>
            </Section>

            <Section icon="copy" title="Duplicate Detection">
              <Card>
                <div style={{ font: `400 14px ${FONT}` }}>
                  {profile.duplicates === 0
                    ? <span style={{ color: T.green, fontWeight: 600 }}>No duplicate records detected.</span>
                    : <>
                        <span style={{ fontWeight: 600, color: T.red }}>
                          {profile.duplicates} duplicate record{profile.duplicates > 1 ? "s" : ""} detected
                        </span>
                        <span style={{ color: T.sub }}> ({profile.dupPct.toFixed(1)}% of rows)</span>
                        {profile.dupSamples.length > 0 && (
                          <div style={{ marginTop: 10, overflowX: "auto" }}>
                            <table style={{ borderCollapse: "collapse", font: `400 12px ${MONO}`, width: "100%" }}>
                              <thead><tr>{fields.slice(0, 6).map((f) => (
                                <th key={f} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${T.line}`, color: T.sub, fontWeight: 500 }}>{f}</th>
                              ))}</tr></thead>
                              <tbody>{profile.dupSamples.map((i) => (
                                <tr key={i}>{fields.slice(0, 6).map((f) => (
                                  <td key={f} style={{ padding: "6px 10px", borderBottom: `1px solid ${T.line}` }}>{String(rows[i][f] ?? "")}</td>
                                ))}</tr>
                              ))}</tbody>
                            </table>
                          </div>
                        )}
                      </>}
                </div>
              </Card>
            </Section>

            <Section icon="type" title="Schema Detection">
              <Card style={{ padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", font: `400 13px ${FONT}` }}>
                  <thead>
                    <tr>{["Column", "Type", "Unique Values", "Missing"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `1px solid ${T.line}`, color: T.sub, font: `500 12px ${FONT}`, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {profile.columns.map((c) => (
                      <tr key={c.name}>
                        <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}` }}>
                          <span style={{
                            font: `500 11px ${MONO}`, padding: "3px 8px", borderRadius: 5,
                            background: c.type === "Numeric" ? "#F0FDFA" : c.type === "Date" ? "#FEF3C7" : c.type === "Boolean" ? "#EDE9FE" : "#F5F5F4",
                            color: c.type === "Numeric" ? T.accent : c.type === "Date" ? T.amber : c.type === "Boolean" ? "#7C3AED" : T.sub,
                          }}>{c.type}</span>
                        </td>
                        <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, font: `500 13px ${MONO}` }}>{c.unique.toLocaleString()}</td>
                        <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, font: `500 13px ${MONO}`, color: riskColor(c.missingPct) }}>{c.missingPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>

            {profile.numericCount > 0 && (
              <Section icon="hash" title="Statistical Summary">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {profile.columns.filter((c) => c.stats).map((c) => (
                    <Card key={c.name}>
                      <div style={{ font: `600 14px ${FONT}`, color: T.ink, marginBottom: 10 }}>{c.name}</div>
                      {([["Mean", c.stats!.mean], ["Median", c.stats!.median], ["Min", c.stats!.min], ["Max", c.stats!.max], ["Std Dev", c.stats!.std]] as [string, number][]).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", font: `400 13px ${FONT}` }}>
                          <span style={{ color: T.sub }}>{k}</span>
                          <span style={{ font: `500 13px ${MONO}` }}>{fmt(v)}</span>
                        </div>
                      ))}
                    </Card>
                  ))}
                </div>
              </Section>
            )}

            <Section icon="table" title="Distribution Explorer">
              <Card>
                <label style={{ font: `500 13px ${FONT}`, color: T.sub, display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  Column
                  <select value={selectedDist ?? ""} onChange={(e) => setDistCol(e.target.value)} style={{
                    font: `500 13px ${FONT}`, color: T.ink, padding: "7px 10px",
                    border: `1px solid ${T.line}`, borderRadius: 8, background: T.card,
                  }}>
                    {profile.columns.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                  </select>
                </label>
                {distData && (
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={distData.data} margin={{ bottom: distData.kind === "histogram" ? 50 : 30, right: 12 }}>
                        <CartesianGrid vertical={false} stroke={T.line} />
                        <XAxis dataKey="label" angle={-32} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: T.sub }} />
                        <YAxis tick={{ fontSize: 12, fill: T.sub }} allowDecimals={false} />
                        <Tooltip cursor={{ fill: "#F5F5F4" }} />
                        <Bar dataKey="count" fill={T.accent} radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </Section>

            {profile.numericCount > 0 && (
              <Section icon="alert" title="Outlier Detection" sub="IQR method — values beyond Q1 − 1.5·IQR or Q3 + 1.5·IQR.">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                  {profile.columns.filter((c) => c.stats).map((c) => (
                    <Card key={c.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ font: `600 14px ${FONT}`, color: T.ink }}>{c.name}</span>
                        <span style={{
                          font: `600 13px ${MONO}`,
                          color: c.stats!.outlierCount ? (c.stats!.outlierPct >= 5 ? T.red : T.amber) : T.green,
                        }}>
                          {c.stats!.outlierCount ? `${c.stats!.outlierCount} (${c.stats!.outlierPct.toFixed(1)}%)` : "none"}
                        </span>
                      </div>
                      <div style={{ font: `400 12px ${FONT}`, color: T.sub, marginTop: 6 }}>
                        Bounds: <span style={{ fontFamily: MONO }}>{fmt(c.stats!.lowerBound)}</span> to <span style={{ fontFamily: MONO }}>{fmt(c.stats!.upperBound)}</span>
                      </div>
                      {c.stats!.outlierSamples.length > 0 && (
                        <div style={{ font: `400 12px ${MONO}`, color: T.text, marginTop: 6 }}>
                          e.g. {c.stats!.outlierSamples.map(fmt).join(", ")}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </Section>
            )}

            <Section icon="spark" title="AI Insight Report" sub="A senior-analyst style read of your dataset profile, generated by Llama via Groq.">
              <AIReport profile={profile} />
            </Section>
          </>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: "0 0 28px", font: `400 12px ${FONT}`, color: T.sub }}>
        Himay · Dissect your data before you trust it · profiling runs entirely in your browser
      </footer>
    </div>
  );
}
