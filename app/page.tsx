"use client";

import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { profileDataset, type DatasetProfile, type Row } from "@/lib/profile";
import {
  analyzeResearch, methodologyDrafts, researchForAI, cleanDataset, toCSV,
  buildReportMarkdown, type ResearchReport, type CleanOptions, type CorrelationMatrix,
} from "@/lib/research";
import {
  T, SANS, SERIF, MONO, Icon, ICONS, Navbar, Footer, Card, Section, primaryBtn,
} from "./ui";

/* ---------------- helpers ---------------- */
const downloadText = (filename: string, text: string, mime: string) => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};
const fmt = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Number(v.toFixed(2)).toString();
};
const riskColor = (pct: number) => (pct >= 20 ? T.red : pct >= 5 ? T.accent : T.green);
const riskLabel = (pct: number) => (pct >= 20 ? "High risk" : pct >= 5 ? "Medium risk" : "Low risk");

/* ---------------- score gauge ---------------- */
function Gauge({ score, label, caption }: { score: number; label: string; caption: string }) {
  const color = score >= 85 ? T.green : score >= 60 ? T.accent : T.red;
  const r = 58, c = 2 * Math.PI * r, filled = (score / 100) * c;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width="140" height="140" role="img" aria-label={`${label} ${score} of 100`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke={T.line} strokeWidth="11" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="11"
          strokeLinecap="round" strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 70 70)" style={{ transition: "stroke-dasharray 900ms ease" }} />
        <text x="70" y="66" textAnchor="middle" style={{ font: `600 30px ${MONO}`, fill: T.ink }}>{score}</text>
        <text x="70" y="86" textAnchor="middle" style={{ font: `500 11px ${SANS}`, fill: T.faint }}>/ 100</text>
      </svg>
      <div>
        <div style={{ font: `600 13px ${SANS}`, color: T.faint, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
        <div style={{ font: `600 18px ${SANS}`, color, margin: "2px 0 6px" }}>{caption}</div>
      </div>
    </div>
  );
}

/* ---------------- AI research reviewer ---------------- */
function AIReport({ profile, research, report, onReport }: {
  profile: DatasetProfile; research: ResearchReport;
  report: string | null; onReport: (r: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/insight", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: researchForAI(profile, research) }),
      });
      const data = await res.json();
      if (!res.ok || !data.report) throw new Error(data.error || "Empty response");
      onReport(data.report);
    } catch {
      setError("Could not generate the review. Make sure GROQ_API_KEY is set, then try again.");
    } finally { setLoading(false); }
  };

  return (
    <Card>
      {!report && (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <p style={{ font: `400 15px/1.6 ${SERIF}`, color: T.sub, marginBottom: 16, maxWidth: 560, marginInline: "auto" }}>
            Generate an academic-style review: dataset overview, data-quality assessment, survey-integrity issues,
            research risks, recommended cleaning steps, and a statistical-readiness assessment.
          </p>
          <button onClick={generate} disabled={loading}
            style={{ ...primaryBtn, padding: "11px 24px", fontSize: 15, opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Reviewing…" : "Generate AI Research Review"}
          </button>
          {error && <p style={{ color: T.red, font: `400 13px ${SANS}`, marginTop: 12 }}>{error}</p>}
        </div>
      )}
      {report && (
        <div style={{ font: `400 15px/1.7 ${SERIF}`, color: T.ink }}>
          {report.split("\n").map((line, i) => {
            const t = line.trim();
            if (t.startsWith("###")) return <h3 key={i} style={{ font: `600 16px ${SANS}`, color: T.ink, margin: "18px 0 6px" }}>{t.replace(/^#+\s*/, "")}</h3>;
            if (/^\d+\.\s/.test(t) && t.length < 60) return <h3 key={i} style={{ font: `600 16px ${SANS}`, color: T.ink, margin: "18px 0 6px" }}>{t.replace(/^\d+\.\s*/, "")}</h3>;
            if (/^[-*]\s/.test(t)) return <div key={i} style={{ display: "flex", gap: 9, margin: "4px 0" }}><span style={{ color: T.accent }}>•</span><span>{t.replace(/^[-*]\s/, "").replace(/\*\*/g, "")}</span></div>;
            if (t) return <p key={i} style={{ margin: "7px 0" }}>{t.replace(/\*\*/g, "")}</p>;
            return null;
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------------- methodology assistant ---------------- */
function Methodology({ drafts }: { drafts: { title: string; text: string }[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (i: number, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(i); setTimeout(() => setCopied(null), 1800);
    });
  };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {drafts.map((d, i) => (
        <Card key={d.title}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <span style={{ font: `600 15px ${SANS}`, color: T.ink }}>{d.title}</span>
            <button onClick={() => copy(i, d.text)} style={{
              marginLeft: "auto", background: "transparent", border: `1px solid ${T.line}`,
              borderRadius: 8, padding: "5px 12px", font: `500 12px ${SANS}`,
              color: copied === i ? T.green : T.sub, display: "flex", alignItems: "center", gap: 6,
            }}>
              <Icon d={copied === i ? ICONS.check : ICONS.copy} size={13} color={copied === i ? T.green : T.sub} />
              {copied === i ? "Copied" : "Copy"}
            </button>
          </div>
          <p style={{ font: `400 15px/1.65 ${SERIF}`, color: T.sub, margin: 0, fontStyle: "italic" }}>
            {d.text}
          </p>
        </Card>
      ))}
      <p style={{ font: `400 12px ${SANS}`, color: T.faint, margin: 0 }}>
        Draft language for a methodology or Chapter 3 section. Review and adapt before submitting — figures are filled from your dataset.
      </p>
    </div>
  );
}

/* ---------------- correlation matrix ---------------- */
function CorrMatrix({ corr }: { corr: CorrelationMatrix }) {
  const cell = (r: number | null) => {
    if (r === null) return { bg: "#f4f2ea", fg: T.faint };
    const a = Math.min(1, Math.abs(r));
    if (r >= 0) return { bg: `rgba(217,119,87,${0.12 + a * 0.78})`, fg: a > 0.5 ? "#fff" : T.ink };
    return { bg: `rgba(106,155,204,${0.12 + a * 0.78})`, fg: a > 0.5 ? "#fff" : T.ink };
  };
  const labelCss: React.CSSProperties = { font: `500 11px ${SANS}`, color: T.sub, padding: "4px 6px", whiteSpace: "nowrap" };
  return (
    <Card style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", margin: "0 auto" }}>
        <thead>
          <tr>
            <th />
            {corr.columns.map((c) => (
              <th key={c} style={{ ...labelCss, textAlign: "center", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis" }} title={c}>
                {c.length > 9 ? c.slice(0, 8) + "…" : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corr.matrix.map((row, i) => (
            <tr key={corr.columns[i]}>
              <td style={{ ...labelCss, textAlign: "right", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }} title={corr.columns[i]}>
                {corr.columns[i].length > 14 ? corr.columns[i].slice(0, 13) + "…" : corr.columns[i]}
              </td>
              {row.map((r, j) => {
                const { bg, fg } = cell(r);
                return (
                  <td key={j} title={`${corr.columns[i]} × ${corr.columns[j]}: ${r === null ? "n/a" : r.toFixed(2)}`}
                    style={{ background: bg, color: fg, font: `600 11px ${MONO}`, textAlign: "center", width: 52, height: 36, border: "2px solid #fff" }}>
                    {r === null ? "—" : r.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 16, marginTop: 12, font: `400 12px ${SANS}`, color: T.sub, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(217,119,87,0.9)" }} /> Positive</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(106,155,204,0.9)" }} /> Negative</span>
        <span>Pearson r, computed on complete pairs.</span>
      </div>
    </Card>
  );
}

/* ---------------- cleaning panel ("fix it") ---------------- */
function CleaningPanel({ rows, fields, profile, research }: {
  rows: Row[]; fields: string[]; profile: DatasetProfile; research: ResearchReport;
}) {
  const [opts, setOpts] = useState<CleanOptions>({
    dedupe: profile.duplicates > 0,
    removeInvalid: research.invalidRows.length > 0,
    removeStraightLiners: research.straightLinerRows.length > 0,
    missing: "none",
  });
  const result = useMemo(
    () => cleanDataset(rows, fields, profile, research, opts),
    [rows, fields, profile, research, opts]
  );
  const toggle = (k: keyof CleanOptions) => setOpts((o) => ({ ...o, [k]: !o[k as "dedupe"] }));

  const checks: { key: keyof CleanOptions; label: string; count: number; disabled: boolean }[] = [
    { key: "dedupe", label: "Remove duplicate rows", count: profile.duplicates, disabled: profile.duplicates === 0 },
    { key: "removeInvalid", label: "Remove rows with invalid values", count: research.invalidRows.length, disabled: research.invalidRows.length === 0 },
    { key: "removeStraightLiners", label: "Remove straight-lined responses", count: research.straightLinerRows.length, disabled: research.straightLinerRows.length === 0 },
  ];

  return (
    <Card>
      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        {checks.map((c) => (
          <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, opacity: c.disabled ? 0.5 : 1, cursor: c.disabled ? "default" : "pointer" }}>
            <input type="checkbox" checked={!!opts[c.key]} disabled={c.disabled}
              onChange={() => toggle(c.key)} style={{ width: 16, height: 16, accentColor: T.accent }} />
            <span style={{ font: `500 14px ${SANS}`, color: T.ink }}>{c.label}</span>
            <span style={{ font: `500 12px ${MONO}`, color: c.count ? T.accent : T.faint }}>
              {c.count ? `${c.count} affected` : "none found"}
            </span>
          </label>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ font: `500 14px ${SANS}`, color: T.ink }}>Missing values</span>
          <select value={opts.missing} onChange={(e) => setOpts((o) => ({ ...o, missing: e.target.value as CleanOptions["missing"] }))}
            style={{ font: `500 13px ${SANS}`, color: T.ink, padding: "6px 10px", border: `1px solid ${T.line}`, borderRadius: 8, background: T.card }}>
            <option value="none">Leave as-is</option>
            <option value="drop">Drop rows with any missing value</option>
            <option value="impute">Impute numeric with column median</option>
          </select>
        </label>
      </div>

      <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ font: `600 13px ${SANS}`, color: T.ink, marginBottom: 6 }}>
          Preview: {result.before.toLocaleString()} → <span style={{ color: T.accent }}>{result.after.toLocaleString()}</span> rows
        </div>
        {result.log.map((line, i) => (
          <div key={i} style={{ font: `400 13px ${SERIF}`, color: T.sub, display: "flex", gap: 8 }}>
            <span style={{ color: T.green }}>•</span>{line}
          </div>
        ))}
      </div>

      <button
        onClick={() => downloadText(`cleaned_data.csv`, toCSV(result.rows, result.fields), "text/csv;charset=utf-8")}
        disabled={result.after === 0}
        style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", fontSize: 15 }}>
        <Icon d={ICONS.upload} size={16} color="#fff" /> Download cleaned dataset (.csv)
      </button>
      <p style={{ font: `400 12px ${SANS}`, color: T.faint, margin: "10px 0 0" }}>
        Cleaning runs in your browser on a copy of your data — your original file is never modified.
      </p>
    </Card>
  );
}

/* ---------------- demo dataset (messy on purpose) ---------------- */
const DEMO_CSV = `respondent_id,age,gender,region,q1_ease,q2_quality,q3_value,q4_support,q5_recommend,monthly_income
R001,24,Female,Luzon,4,5,4,4,5,18000
R002,31,Male,Visayas,3,3,4,3,3,25000
R003,28,Female,Mindanao,5,5,5,5,5,22000
R004,45,Male,Luzon,2,2,1,2,2,40000
R005,22,Female,Luzon,4,4,5,4,4,15000
R006,200,Male,Visayas,5,5,5,5,5,28000
R007,33,Female,Mindanao,1,2,2,1,8,31000
R008,29,Male,Luzon,4,5,4,5,4,
R009,38,Female,Visayas,3,3,3,3,3,35000
R010,27,Male,Luzon,5,5,5,5,5,-5000
R001,24,Female,Luzon,4,5,4,4,5,18000
R012,41,Male,Mindanao,2,1,2,2,1,46000
R013,35,Female,Visayas,4,4,4,4,4,33000
R014,26,Male,Luzon,5,4,5,4,5,20000
R015,30,Female,Mindanao,3,4,3,4,3,27000
R016,52,Male,Luzon,2,2,2,2,2,55000
R017,23,Female,Visayas,5,5,4,5,5,16000
R018,36,Male,Luzon,4,3,4,3,4,38000
R019,28,Female,Mindanao,1,1,1,1,1,24000
R020,44,Male,Visayas,3,3,4,3,3,42000`;

/* ---------------- landing-page pieces ---------------- */
const FEATURES = [
  { icon: "gauge", title: "Research Readiness Score", body: "A 0–100 read on whether your dataset is actually ready for analysis — beyond raw data quality." },
  { icon: "shield", title: "Survey Integrity Checks", body: "Catches invalid values, straight-lined responses, and low-variance answering that quietly bias results." },
  { icon: "list", title: "Likert Scale Detection", body: "Finds 1–5 and 1–7 scale items automatically and summarizes each with mean, median, and distribution." },
  { icon: "chart", title: "Statistical Readiness", body: "Tells you which analyses your data can support — descriptives, correlation, regression, t-test, ANOVA." },
  { icon: "spark", title: "AI Research Reviewer", body: "A senior-analyst review in plain language: issues, risks, and the exact cleaning steps to take." },
  { icon: "doc", title: "Methodology Assistant", body: "Ready-to-adapt data-cleaning and dataset-description paragraphs, filled with your real numbers." },
];

const HOW_STEPS = [
  { n: 1, t: "Upload", b: "Drop a CSV or Excel export from Google Forms, Microsoft Forms, SurveyMonkey, or Excel." },
  { n: 2, t: "Analyze", b: "Himay profiles structure, quality, and survey integrity instantly — all in your browser." },
  { n: 3, t: "Review", b: "Read the scores, flags, and an AI research review with concrete cleaning recommendations." },
  { n: 4, t: "Proceed", b: "Move on to statistics, dashboards, ML, or thesis writing — knowing your data holds up." },
];

/* ---------------- main page ---------------- */
interface SheetData { name: string; rows: Row[]; fields: string[]; usable: boolean }

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [distCol, setDistCol] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const profile = useMemo(
    () => (rows && rows.length ? profileDataset(rows, fields) : null),
    [rows, fields]
  );
  const research = useMemo(
    () => (rows && profile ? analyzeResearch(rows, fields, profile) : null),
    [rows, fields, profile]
  );

  const loadData = (f: File, data: Row[], flds: string[]) => {
    if (!data.length || !flds.length) {
      setParseError("The file appears to be empty or has no header row."); return;
    }
    setFile(f); setRows(data); setFields(flds); setDistCol(null); setAiReport(null);
    window.scrollTo({ top: 0 });
  };

  const loadDemo = () => {
    handleFile(new File([DEMO_CSV], "demo_survey.csv", { type: "text/csv" }));
  };

  const handleFile = (f: File | undefined | null) => {
    if (!f) return;
    setParseError(null);
    if (/\.csv$/i.test(f.name)) {
      Papa.parse<Row>(f, {
        header: true, skipEmptyLines: "greedy",
        complete: (res) => {
          setSheets(null); setActiveSheet(null);
          loadData(f, res.data, res.meta.fields ?? []);
        },
        error: () => setParseError("Could not parse this file."),
      });
      return;
    }
    if (/\.xlsx?$/i.test(f.name)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const parsed: SheetData[] = wb.SheetNames.map((name) => {
            const data = XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { defval: "", raw: false });
            const flds = data.length ? Object.keys(data[0]) : [];
            return { name, rows: data, fields: flds, usable: data.length > 0 && flds.length > 0 };
          });
          const usable = parsed.filter((s) => s.usable);
          if (!usable.length) { setParseError("This workbook has no readable data sheets."); return; }
          setSheets(parsed.length > 1 ? parsed : null);
          setActiveSheet(parsed.length > 1 ? usable[0].name : null);
          loadData(f, usable[0].rows, usable[0].fields);
        } catch { setParseError("Could not read this Excel file."); }
      };
      reader.onerror = () => setParseError("Could not read this file.");
      reader.readAsArrayBuffer(f);
      return;
    }
    setParseError("Please upload a CSV or Excel (.xlsx) file.");
  };

  const selectSheet = (name: string) => {
    const s = sheets?.find((x) => x.name === name);
    if (!s || !s.usable || !file) return;
    setActiveSheet(name);
    loadData(file, s.rows, s.fields);
  };

  const triggerUpload = () => inputRef.current?.click();

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
      return { kind: "histogram" as const, data: counts.map((count, i) => ({ label: `${fmt(min + i * w)}–${fmt(min + (i + 1) * w)}`, count })) };
    }
    return { kind: "frequency" as const, data: (col.topValues || []).map(([label, count]) => ({ label, count })) };
  }, [profile, selectedDist]);

  const reset = () => { setFile(null); setRows(null); setFields([]); setDistCol(null); setAiReport(null); setSheets(null); setActiveSheet(null); };

  const drafts = profile && research ? methodologyDrafts(profile, research) : [];

  return (
    <div style={{ minHeight: "100vh" }}>
      <style>{`.hcard:hover{ box-shadow: 0 4px 16px rgba(20,20,19,.06); transform: translateY(-1px); }
        .hcard{ transition: box-shadow 200ms, transform 200ms; }`}</style>

      <Navbar onUpload={triggerUpload} />
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])} />

      {/* ===================== LANDING ===================== */}
      {!profile && (
        <>
          <section style={{ maxWidth: 860, margin: "0 auto", padding: "64px 20px 28px", textAlign: "center" }}>
            <span style={{
              font: `600 13px ${SANS}`, color: T.accent, background: "#fdf1ec",
              border: `1px solid #f3d9cf`, borderRadius: 999, padding: "5px 14px",
              letterSpacing: "0.2px",
            }}>AI-Powered Data Profiling & Research Validation</span>
            <h1 style={{ font: `700 clamp(32px, 6vw, 56px) ${SANS}`, color: T.ink, letterSpacing: "-1.5px", lineHeight: 1.05, margin: "22px 0 0" }}>
              Himayin ang datos<br />bago pagkatiwalaan.
            </h1>
            <p style={{ font: `400 19px/1.6 ${SERIF}`, color: T.sub, maxWidth: 600, margin: "20px auto 30px" }}>
              Validate datasets, detect research issues, and prepare your data for analysis in minutes —
              before you start reporting, dashboarding, or writing your thesis.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={triggerUpload} style={{ ...primaryBtn, padding: "13px 28px", fontSize: 16, display: "flex", alignItems: "center", gap: 9 }}>
                <Icon d={ICONS.upload} size={18} color="#fff" /> Upload Dataset
              </button>
              <a href="#how-it-works" style={{
                padding: "13px 28px", fontSize: 16, font: `600 16px ${SANS}`, color: T.ink,
                border: `1px solid ${T.line}`, borderRadius: 9, background: T.card,
              }}>Learn How It Works</a>
            </div>
            <p style={{ font: `400 13px ${MONO}`, color: T.faint, marginTop: 18 }}>
              CSV & Excel · no account · no database · runs in your browser
            </p>
          </section>

          {/* drop zone */}
          <section style={{ maxWidth: 640, margin: "0 auto 12px", padding: "0 20px" }}>
            <div role="button" tabIndex={0} aria-label="Upload CSV or Excel dataset"
              onClick={triggerUpload}
              onKeyDown={(e) => e.key === "Enter" && triggerUpload()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              style={{
                padding: "40px 24px", textAlign: "center",
                border: `2px dashed ${dragOver ? T.accent : T.line}`,
                background: dragOver ? "#fdf1ec" : T.card, borderRadius: 16,
                cursor: "pointer", transition: "all 200ms",
              }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <Icon d={ICONS.upload} size={30} />
              </div>
              <div style={{ font: `600 16px ${SANS}`, color: T.ink }}>Drop your dataset here</div>
              <div style={{ font: `400 14px ${SERIF}`, color: T.sub, marginTop: 6 }}>
                .csv or .xlsx — or click to browse
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={loadDemo} style={{
                background: "transparent", border: "none", cursor: "pointer",
                font: `500 14px ${SANS}`, color: T.accent,
                display: "inline-flex", alignItems: "center", gap: 7,
              }}>
                <Icon d={ICONS.spark} size={15} /> No file handy? Try it with a demo dataset
              </button>
            </div>
            {parseError && <p style={{ color: T.red, font: `400 14px ${SANS}`, marginTop: 14, textAlign: "center" }}>{parseError}</p>}
          </section>

          {/* features */}
          <section id="features" style={{ background: T.panel, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, marginTop: 48, padding: "56px 20px" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <h2 style={{ font: `700 30px ${SANS}`, color: T.ink, letterSpacing: "-0.6px", textAlign: "center", margin: "0 0 8px" }}>
                More than a CSV profiler
              </h2>
              <p style={{ font: `400 17px ${SERIF}`, color: T.sub, textAlign: "center", maxWidth: 560, margin: "0 auto 40px" }}>
                Himay checks the things that quietly break research — long before they show up in your results.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {FEATURES.map((f) => (
                  <div key={f.title} className="hcard" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 22 }}>
                    <Icon d={ICONS[f.icon]} size={22} />
                    <h3 style={{ font: `600 17px ${SANS}`, color: T.ink, margin: "12px 0 6px" }}>{f.title}</h3>
                    <p style={{ font: `400 15px/1.6 ${SERIF}`, color: T.sub, margin: 0 }}>{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* how it works */}
          <section id="how-it-works" style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 20px" }}>
            <h2 style={{ font: `700 30px ${SANS}`, color: T.ink, letterSpacing: "-0.6px", textAlign: "center", margin: "0 0 40px" }}>
              Upload → Analyze → Generate Insights
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {HOW_STEPS.map((s) => (
                <div key={s.n} style={{ position: "relative", padding: "4px 4px 0" }}>
                  <div style={{ font: `600 14px ${MONO}`, color: T.accent }}>0{s.n}</div>
                  <h3 style={{ font: `600 18px ${SANS}`, color: T.ink, margin: "6px 0 6px" }}>{s.t}</h3>
                  <p style={{ font: `400 15px/1.6 ${SERIF}`, color: T.sub, margin: 0 }}>{s.b}</p>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <button onClick={triggerUpload} style={{ ...primaryBtn, padding: "13px 28px", fontSize: 16 }}>
                Upload Dataset
              </button>
            </div>
          </section>

          <Footer />
        </>
      )}

      {/* ===================== ANALYSIS ===================== */}
      {profile && research && file && rows && (
        <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 20px 64px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 style={{ font: `700 24px ${SANS}`, color: T.ink, margin: 0, letterSpacing: "-0.5px" }}>{file.name}</h1>
            <span style={{ font: `500 13px ${MONO}`, color: T.sub }}>
              {(file.size / 1024).toFixed(1)} KB · {profile.rows.toLocaleString()} rows · {profile.cols} columns
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => downloadText(
                `${file.name.replace(/\.[^.]+$/, "")}_himay_report.md`,
                buildReportMarkdown(
                  { name: file.name, rows: profile.rows, cols: profile.cols },
                  profile, research, methodologyDrafts(profile, research), aiReport
                ),
                "text/markdown;charset=utf-8"
              )} style={{
                background: "transparent", border: `1px solid ${T.line}`, borderRadius: 9,
                padding: "7px 15px", font: `500 13px ${SANS}`, color: T.ink,
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <Icon d={ICONS.doc} size={14} color={T.sub} /> Download report
              </button>
              <button onClick={reset} style={{
                background: "transparent", border: `1px solid ${T.line}`,
                borderRadius: 9, padding: "7px 15px", font: `500 13px ${SANS}`, color: T.ink,
              }}>New dataset</button>
            </div>
          </div>

          {/* sheet picker (Excel workbooks with >1 sheet) */}
          {sheets && sheets.length > 1 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ font: `500 11px ${SANS}`, color: T.faint, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
                <Icon d={ICONS.table} size={14} color={T.faint} /> Workbook sheets — analyzing one at a time
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sheets.map((s) => {
                  const active = s.name === activeSheet;
                  return (
                    <button key={s.name} onClick={() => s.usable && selectSheet(s.name)} disabled={!s.usable}
                      title={s.usable ? `${s.rows.length} rows` : "No readable data in this sheet"}
                      style={{
                        font: `500 13px ${SANS}`, padding: "7px 14px", borderRadius: 9,
                        border: `1px solid ${active ? T.accent : T.line}`,
                        background: active ? "#fdf1ec" : s.usable ? T.card : T.panel,
                        color: !s.usable ? T.faint : active ? T.accentDark : T.ink,
                        cursor: s.usable ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", gap: 7,
                      }}>
                      {s.name}
                      <span style={{ font: `500 11px ${MONO}`, color: !s.usable ? T.faint : active ? T.accent : T.sub }}>
                        {s.usable ? s.rows.length : "empty"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* scores */}
          <Section icon="gauge" title="Scores" sub="Data quality measures the dataset itself; research readiness measures whether it's ready for analysis.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
              <Card><Gauge score={profile.score} label="Himay Score (Data Quality)" caption={profile.grade} /></Card>
              <Card><Gauge score={research.readinessScore} label="Research Readiness" caption={research.readinessBand} /></Card>
            </div>
          </Section>

          {/* overview */}
          <Section icon="table" title="Dataset Overview">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              {([
                ["Total Rows", profile.rows.toLocaleString()],
                ["Valid Responses", research.validResponses.toLocaleString()],
                ["Total Columns", profile.cols],
                ["Missing Values", `${profile.totalMissing.toLocaleString()} (${profile.missingPct.toFixed(1)}%)`],
                ["Duplicate Rows", profile.duplicates.toLocaleString()],
                ["Likert Items", research.likert.length],
              ] as [string, string | number][]).map(([label, value]) => (
                <div key={label} className="hcard" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ font: `500 11px ${SANS}`, color: T.faint, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
                  <div style={{ font: `600 21px ${MONO}`, color: T.ink, marginTop: 6 }}>{value}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* survey integrity */}
          <Section icon="shield" title="Survey Integrity" sub="Signals that responses may be invalid or low-effort — the issues that bias analysis if left in.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 12 }}>
              <Card>
                <div style={{ font: `600 14px ${SANS}`, color: T.ink, marginBottom: 4 }}>Straight-lining</div>
                <div style={{ font: `600 22px ${MONO}`, color: research.straightLiners ? T.red : T.green }}>
                  {research.likert.length >= 3 ? `${research.straightLiners} (${research.straightLinerPct.toFixed(1)}%)` : "—"}
                </div>
                <p style={{ font: `400 13px/1.5 ${SERIF}`, color: T.sub, margin: "6px 0 0" }}>
                  {research.likert.length >= 3
                    ? "Respondents who gave the same answer to every scale item."
                    : "Needs 3+ detected Likert items to assess."}
                </p>
              </Card>
              <Card>
                <div style={{ font: `600 14px ${SANS}`, color: T.ink, marginBottom: 4 }}>Low-variance responses</div>
                <div style={{ font: `600 22px ${MONO}`, color: research.lowVariance ? T.accent : T.green }}>
                  {research.likert.length >= 3 ? `${research.lowVariance} (${research.lowVariancePct.toFixed(1)}%)` : "—"}
                </div>
                <p style={{ font: `400 13px/1.5 ${SERIF}`, color: T.sub, margin: "6px 0 0" }}>
                  {research.likert.length >= 3
                    ? "Near-identical answering across items — possible response bias."
                    : "Needs 3+ detected Likert items to assess."}
                </p>
              </Card>
              <Card>
                <div style={{ font: `600 14px ${SANS}`, color: T.ink, marginBottom: 4 }}>Invalid-value flags</div>
                <div style={{ font: `600 22px ${MONO}`, color: research.invalidFlags.length ? T.red : T.green }}>
                  {research.invalidFlags.length}
                </div>
                <p style={{ font: `400 13px/1.5 ${SERIF}`, color: T.sub, margin: "6px 0 0" }}>
                  {research.invalidFlags.length ? "Columns containing out-of-range values." : "No out-of-range values detected."}
                </p>
              </Card>
            </div>
            {research.invalidFlags.length > 0 && (
              <Card style={{ padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", font: `400 13px ${SANS}` }}>
                  <thead><tr>{["Column", "Issue", "Count", "Examples"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `1px solid ${T.line}`, color: T.faint, font: `600 12px ${SANS}`, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{research.invalidFlags.map((f) => (
                    <tr key={f.column}>
                      <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, fontWeight: 500 }}>{f.column}</td>
                      <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, color: T.sub }}>{f.issue}</td>
                      <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, font: `600 13px ${MONO}`, color: T.red }}>{f.count}</td>
                      <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, font: `400 12px ${MONO}`, color: T.sub }}>{f.examples.join(", ")}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </Card>
            )}
          </Section>

          {/* likert */}
          {research.likert.length > 0 && (
            <Section icon="list" title="Likert Scale Analysis" sub="Detected rating-scale items, summarized per question.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {research.likert.map((l) => {
                  const maxCount = Math.max(...l.distribution.map((d) => d.count), 1);
                  return (
                    <Card key={l.name}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <span style={{ font: `600 14px ${SANS}`, color: T.ink }}>{l.name}</span>
                        <span style={{ font: `500 11px ${MONO}`, color: T.accent, background: "#fdf1ec", borderRadius: 5, padding: "2px 7px" }}>1–{l.scale}</span>
                      </div>
                      <div style={{ display: "flex", gap: 14, margin: "8px 0 12px", font: `500 12px ${SANS}`, color: T.sub }}>
                        <span>Mean <b style={{ fontFamily: MONO, color: T.ink }}>{l.mean.toFixed(2)}</b></span>
                        <span>Median <b style={{ fontFamily: MONO, color: T.ink }}>{l.median}</b></span>
                        <span>SD <b style={{ fontFamily: MONO, color: T.ink }}>{l.std.toFixed(2)}</b></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 56 }}>
                        {l.distribution.map((d) => (
                          <div key={d.point} style={{ flex: 1, textAlign: "center" }}>
                            <div style={{ height: `${(d.count / maxCount) * 44}px`, background: T.accent, borderRadius: "3px 3px 0 0", minHeight: 2, opacity: 0.85 }} />
                            <div style={{ font: `500 10px ${MONO}`, color: T.faint, marginTop: 3 }}>{d.point}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}

          {/* statistical readiness */}
          <Section icon="chart" title="Statistical Readiness" sub="Which analyses this dataset can reasonably support. Guidance, not a substitute for your judgment.">
            <Card style={{ padding: 0 }}>
              {research.statTests.map((t, i) => (
                <div key={t.name} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 18px", borderTop: i ? `1px solid ${T.line}` : "none" }}>
                  <div style={{ marginTop: 1, flexShrink: 0 }}>
                    <Icon d={t.suitable ? ICONS.check : ICONS.alert} size={17} color={t.suitable ? T.green : T.accent} />
                  </div>
                  <div>
                    <span style={{ font: `600 14px ${SANS}`, color: T.ink }}>{t.name}</span>
                    <span style={{ font: `500 12px ${SANS}`, color: t.suitable ? T.green : T.accent, marginLeft: 10 }}>
                      {t.suitable ? "Suitable" : "Not yet"}
                    </span>
                    <p style={{ font: `400 13px/1.5 ${SERIF}`, color: T.sub, margin: "2px 0 0" }}>{t.note}</p>
                  </div>
                </div>
              ))}
            </Card>
          </Section>

          {/* missing values */}
          <Section icon="alert" title="Missing Value Analysis">
            <Card>
              <div style={{ height: Math.max(120, profile.columns.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profile.columns.map((c) => ({ name: c.name, pct: +c.missingPct.toFixed(1) }))}
                    layout="vertical" margin={{ left: 8, right: 36 }}>
                    <CartesianGrid horizontal={false} stroke={T.line} />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: T.sub }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: T.ink }} />
                    <Tooltip formatter={(v) => [`${v}% missing`, riskLabel(Number(v))]} cursor={{ fill: "#f4f2ea" }} />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} background={{ fill: "#f4f2ea" }}>
                      {profile.columns.map((c) => <Cell key={c.name} fill={riskColor(c.missingPct)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, font: `400 12px ${SANS}`, color: T.sub }}>
                {([[T.green, "Low (<5%)"], [T.accent, "Medium (5–20%)"], [T.red, "High (≥20%)"]] as [string, string][]).map(([c, l]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                  </span>
                ))}
              </div>
            </Card>
          </Section>

          {/* duplicates */}
          <Section icon="copy" title="Duplicate Detection">
            <Card>
              <div style={{ font: `400 15px ${SERIF}` }}>
                {profile.duplicates === 0
                  ? <span style={{ color: T.green, fontWeight: 600, fontFamily: SANS }}>No duplicate records detected.</span>
                  : <>
                      <span style={{ fontWeight: 600, color: T.red, fontFamily: SANS }}>
                        {profile.duplicates} duplicate record{profile.duplicates > 1 ? "s" : ""} detected
                      </span>
                      <span style={{ color: T.sub }}> ({profile.dupPct.toFixed(1)}% of rows)</span>
                      {profile.dupSamples.length > 0 && (
                        <div style={{ marginTop: 10, overflowX: "auto" }}>
                          <table style={{ borderCollapse: "collapse", font: `400 12px ${MONO}`, width: "100%" }}>
                            <thead><tr>{fields.slice(0, 6).map((f) => (
                              <th key={f} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${T.line}`, color: T.faint, fontWeight: 500 }}>{f}</th>
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

          {/* schema */}
          <Section icon="type" title="Schema Detection">
            <Card style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", font: `400 13px ${SANS}` }}>
                <thead><tr>{["Column", "Type", "Unique", "Missing"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `1px solid ${T.line}`, color: T.faint, font: `600 12px ${SANS}`, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
                ))}</tr></thead>
                <tbody>{profile.columns.map((c) => (
                  <tr key={c.name}>
                    <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}` }}>
                      <span style={{
                        font: `500 11px ${MONO}`, padding: "3px 8px", borderRadius: 5,
                        background: c.type === "Numeric" ? "#fdf1ec" : c.type === "Date" ? "#eef3ea" : c.type === "Boolean" ? "#eaf0f6" : "#f4f2ea",
                        color: c.type === "Numeric" ? T.accent : c.type === "Date" ? T.green : c.type === "Boolean" ? T.blue : T.sub,
                      }}>{c.type}</span>
                    </td>
                    <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, font: `500 13px ${MONO}` }}>{c.unique.toLocaleString()}</td>
                    <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.line}`, font: `500 13px ${MONO}`, color: riskColor(c.missingPct) }}>{c.missingPct.toFixed(1)}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          </Section>

          {/* stats */}
          {profile.numericCount > 0 && (
            <Section icon="hash" title="Statistical Summary">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {profile.columns.filter((c) => c.stats).map((c) => (
                  <Card key={c.name}>
                    <div style={{ font: `600 14px ${SANS}`, color: T.ink, marginBottom: 10 }}>{c.name}</div>
                    {([["Mean", c.stats!.mean], ["Median", c.stats!.median], ["Min", c.stats!.min], ["Max", c.stats!.max], ["Std Dev", c.stats!.std]] as [string, number][]).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", font: `400 13px ${SANS}` }}>
                        <span style={{ color: T.sub }}>{k}</span>
                        <span style={{ font: `500 13px ${MONO}` }}>{fmt(v)}</span>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* distribution */}
          <Section icon="chart" title="Distribution Explorer">
            <Card>
              <label style={{ font: `500 13px ${SANS}`, color: T.sub, display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                Column
                <select value={selectedDist ?? ""} onChange={(e) => setDistCol(e.target.value)} style={{
                  font: `500 13px ${SANS}`, color: T.ink, padding: "7px 10px",
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
                      <Tooltip cursor={{ fill: "#f4f2ea" }} />
                      <Bar dataKey="count" fill={T.accent} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </Section>

          {/* outliers */}
          {profile.numericCount > 0 && (
            <Section icon="alert" title="Outlier Detection" sub="IQR method — values beyond Q1 − 1.5·IQR or Q3 + 1.5·IQR.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {profile.columns.filter((c) => c.stats).map((c) => (
                  <Card key={c.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ font: `600 14px ${SANS}`, color: T.ink }}>{c.name}</span>
                      <span style={{ font: `600 13px ${MONO}`, color: c.stats!.outlierCount ? (c.stats!.outlierPct >= 5 ? T.red : T.accent) : T.green }}>
                        {c.stats!.outlierCount ? `${c.stats!.outlierCount} (${c.stats!.outlierPct.toFixed(1)}%)` : "none"}
                      </span>
                    </div>
                    <div style={{ font: `400 12px ${SANS}`, color: T.sub, marginTop: 6 }}>
                      Bounds: <span style={{ fontFamily: MONO }}>{fmt(c.stats!.lowerBound)}</span> to <span style={{ fontFamily: MONO }}>{fmt(c.stats!.upperBound)}</span>
                    </div>
                    {c.stats!.outlierSamples.length > 0 && (
                      <div style={{ font: `400 12px ${MONO}`, color: T.ink, marginTop: 6 }}>
                        e.g. {c.stats!.outlierSamples.map(fmt).join(", ")}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* correlation matrix */}
          {research.correlations && (
            <Section icon="hash" title="Correlation Matrix" sub="How numeric variables move together. Strong correlations can signal redundancy or relationships worth testing.">
              <CorrMatrix corr={research.correlations} />
            </Section>
          )}

          {/* AI reviewer */}
          <Section icon="spark" title="AI Research Reviewer" sub="An academic-style review of your dataset, generated by Llama 3.3 via Groq.">
            <AIReport profile={profile} research={research} report={aiReport} onReport={setAiReport} />
          </Section>

          {/* methodology */}
          <Section icon="doc" title="Methodology Assistant" sub="Draft write-ups for your methodology or Chapter 3, populated with your dataset's figures.">
            <Methodology drafts={drafts} />
          </Section>

          {/* cleaning */}
          <Section icon="check" title="Clean & Export" sub="Apply the fixes Himay found, then download an analysis-ready copy of your dataset.">
            <CleaningPanel rows={rows} fields={fields} profile={profile} research={research} />
          </Section>

          <Footer />
        </main>
      )}
    </div>
  );
}
