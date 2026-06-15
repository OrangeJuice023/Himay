"use client";

import Link from "next/link";
import { T, SANS, SERIF, MONO, Icon, ICONS, Navbar, Footer, Card, primaryBtn } from "../ui";

const steps = [
  {
    n: 1, title: "Export your survey or dataset",
    body: "Save your data as a CSV or XLSX file. Almost every tool can produce one of these formats.",
    extra: ["Google Forms", "Microsoft Forms", "Excel", "SurveyMonkey", "Internal datasets"],
    extraLabel: "Supported sources",
  },
  {
    n: 2, title: "Upload your file",
    body: "Drop the file onto Himay. No account is required, nothing is stored in a database, and your file stays on your device — it is only summarized when you choose to generate AI insights.",
    note: "Excel workbook with multiple sheets? Himay analyzes one sheet at a time. A sheet picker appears at the top of your results — switch between tabs anytime, and empty or non-data sheets are greyed out automatically.",
  },
  {
    n: 3, title: "Review the results",
    body: "Himay profiles your dataset instantly and surfaces the things that matter before analysis.",
    extra: ["Himay Score", "Research Readiness Score", "Missing Values", "Duplicate Records", "Outliers", "Survey Integrity Flags"],
    extraLabel: "What you'll see",
  },
  {
    n: 4, title: "Read the AI recommendations",
    body: "Generate an AI research review that explains the issues in plain language and lists the cleaning steps to apply.",
  },
  {
    n: 5, title: "Proceed with confidence",
    body: "Once your data is clean, move on to the work that actually matters.",
    extra: ["Statistical Analysis", "Dashboarding", "Machine Learning", "Thesis Writing"],
    extraLabel: "Next steps",
  },
];

export default function HowToUse() {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 64px" }}>
        <p style={{ font: `600 13px ${SANS}`, color: T.accent, letterSpacing: "0.4px", textTransform: "uppercase", margin: 0 }}>
          How To Use
        </p>
        <h1 style={{ font: `700 clamp(28px, 5vw, 42px) ${SANS}`, color: T.ink, letterSpacing: "-1px", margin: "8px 0 14px" }}>
          From raw export to analysis-ready in five steps
        </h1>
        <p style={{ font: `400 17px/1.6 ${SERIF}`, color: T.sub, maxWidth: 620, marginBottom: 40 }}>
          You don&apos;t need to be an analyst. Himay walks you through preparing your data and
          interpreting what it finds, so you can trust your dataset before you build on it.
        </p>

        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          {steps.map((s) => (
            <li key={s.n}>
              <Card style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                <div style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: "50%",
                  background: T.accent, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  font: `600 18px ${SANS}`,
                }}>{s.n}</div>
                <div>
                  <h2 style={{ font: `600 19px ${SANS}`, color: T.ink, margin: "4px 0 6px" }}>{s.title}</h2>
                  <p style={{ font: `400 15px/1.6 ${SERIF}`, color: T.sub, margin: 0 }}>{s.body}</p>
                  {s.note && (
                    <div style={{
                      marginTop: 12, padding: "10px 14px", borderRadius: 10,
                      background: "#fdf1ec", border: `1px solid #f3d9cf`,
                      font: `400 14px/1.55 ${SERIF}`, color: T.ink,
                      display: "flex", gap: 9, alignItems: "flex-start",
                    }}>
                      <span style={{ flexShrink: 0, marginTop: 2 }}><Icon d={ICONS.table} size={15} color={T.accent} /></span>
                      <span>{s.note}</span>
                    </div>
                  )}
                  {s.extra && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ font: `600 12px ${SANS}`, color: T.faint, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>
                        {s.extraLabel}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {s.extra.map((e) => (
                          <span key={e} style={{
                            font: `500 13px ${SANS}`, color: T.ink, background: T.panel,
                            border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 12px",
                          }}>{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <div style={{ textAlign: "center", marginTop: 44 }}>
          <Link href="/" style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", fontSize: 15 }}>
            <Icon d={ICONS.upload} size={18} color="#fff" /> Upload your dataset
          </Link>
          <p style={{ font: `400 13px ${MONO}`, color: T.faint, marginTop: 14 }}>
            No account · no database · runs in your browser
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
