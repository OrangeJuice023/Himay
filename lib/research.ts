// Research-validation layer — builds on profile.ts. Still 100% client-side.
import type { DatasetProfile, Row, ColumnProfile } from "./profile";

const isMissing = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const asNumber = (v: unknown): number | null => {
  const s = String(v).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ""))) return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export interface LikertColumn {
  name: string; scale: 5 | 7;
  mean: number; median: number; std: number;
  distribution: { point: number; count: number }[];
}

export interface IntegrityFlag {
  column: string; issue: string; count: number; examples: string[];
}

export interface StatTest {
  name: string; suitable: boolean; note: string;
}

export interface ResearchReport {
  readinessScore: number;
  readinessBand: string;
  validResponses: number;
  likert: LikertColumn[];
  invalidFlags: IntegrityFlag[];
  straightLiners: number;
  straightLinerPct: number;
  lowVariance: number;
  lowVariancePct: number;
  statTests: StatTest[];
  groupingVars: { name: string; groups: number }[];
  invalidRows: number[];        // row indices containing >=1 invalid value
  straightLinerRows: number[];  // row indices flagged as straight-lining
  correlations: CorrelationMatrix | null;
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: (number | null)[][]; // Pearson r, null if not computable
}

const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// A numeric column is Likert if the bulk of its integer values sit inside a
// 1–5 or 1–7 range, it reaches the top of the scale, and shows real spread.
// Detection is share-based: a few out-of-range values (e.g. an 8 on a 1–5 scale)
// don't block detection — they get flagged separately as invalid.
function detectLikert(col: ColumnProfile, values: string[]): LikertColumn | null {
  if (col.type !== "Numeric") return null;
  const nums = values.map(asNumber).filter((v): v is number => v !== null);
  if (nums.length < 5) return null;
  const ints = nums.filter((v) => Number.isInteger(v));
  if (ints.length / nums.length < 0.95) return null; // scales are integers

  const inRange = ints.filter((v) => v >= 1 && v <= 7);
  if (inRange.length / nums.length < 0.8) return null; // mostly within 1–7

  const maxInRange = Math.max(...inRange);
  const scale: 5 | 7 = maxInRange <= 5 ? 5 : 7;
  const onScale = ints.filter((v) => v >= 1 && v <= scale);
  const distinct = new Set(onScale).size;
  if (distinct < 3 || maxInRange < 4) return null; // needs spread + reaches top

  // summarize using only valid on-scale values
  const counts = new Map<number, number>();
  for (let p = 1; p <= scale; p++) counts.set(p, 0);
  onScale.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));

  return {
    name: col.name, scale,
    mean: onScale.reduce((a, b) => a + b, 0) / onScale.length,
    median: median(onScale),
    std: std(onScale),
    distribution: [...counts.entries()].map(([point, count]) => ({ point, count })),
  };
}

export function analyzeResearch(
  rows: Row[], fields: string[], profile: DatasetProfile
): ResearchReport {
  const n = rows.length;
  const colByName = new Map(profile.columns.map((c) => [c.name, c]));

  // ---- Likert columns ----
  const likert: LikertColumn[] = [];
  for (const field of fields) {
    const col = colByName.get(field);
    if (!col) continue;
    const detected = detectLikert(col, rows.map((r) => r[field]));
    if (detected) likert.push(detected);
  }
  const likertNames = new Set(likert.map((l) => l.name));
  const likertScale = new Map(likert.map((l) => [l.name, l.scale]));

  // ---- Invalid-value flags ----
  const invalidFlags: IntegrityFlag[] = [];
  const invalidRowSet = new Set<number>();
  for (const field of fields) {
    const col = colByName.get(field);
    if (!col || col.type !== "Numeric") continue;
    const lname = field.toLowerCase();
    const scale = likertScale.get(field);
    const bad: string[] = [];

    rows.forEach((r, i) => {
      const v = r[field];
      if (isMissing(v)) return;
      const num = asNumber(v);
      if (num === null) return;
      let isBad = false;
      if (scale && (num < 1 || num > scale)) isBad = true;
      else if (/\bage\b/.test(lname) && (num < 0 || num > 120)) isBad = true;
      else if (/salary|income|price|cost|amount|revenue|fee|wage/.test(lname) && num < 0) isBad = true;
      else if (/\b(count|qty|quantity|number|num|years?|hours?)\b/.test(lname) && num < 0) isBad = true;
      if (isBad) { bad.push(String(v)); invalidRowSet.add(i); }
    });

    if (bad.length) {
      invalidFlags.push({
        column: field,
        issue: scale ? `Values outside the 1–${scale} scale`
          : /\bage\b/.test(lname) ? "Implausible age values"
          : "Negative values where none are expected",
        count: bad.length,
        examples: [...new Set(bad)].slice(0, 4),
      });
    }
  }

  // ---- Straight-lining & low-variance (needs >=3 Likert columns) ----
  const straightLinerRows: number[] = [];
  let straightLiners = 0, lowVariance = 0;
  if (likert.length >= 3) {
    const names = [...likertNames];
    rows.forEach((r, i) => {
      const vals = names
        .map((nm) => asNumber(r[nm]))
        .filter((v): v is number => v !== null);
      if (vals.length < 3) return;
      const s = std(vals);
      if (s === 0) { straightLiners++; straightLinerRows.push(i); }
      else if (s < 0.5) lowVariance++;
    });
  }
  const straightLinerPct = n ? (straightLiners / n) * 100 : 0;
  const lowVariancePct = n ? (lowVariance / n) * 100 : 0;

  // ---- Grouping variables (for t-test / ANOVA suitability) ----
  const groupingVars = profile.columns
    .filter((c) => (c.type === "Text" || c.type === "Boolean"))
    .map((c) => ({ name: c.name, groups: c.unique }))
    .filter((g) => g.groups >= 2 && g.groups <= 10);

  // ---- Research Readiness Score ----
  const totalCells = n * fields.length;
  const invalidCells = invalidFlags.reduce((a, f) => a + f.count, 0);
  const invalidPct = totalCells ? (invalidCells / totalCells) * 100 : 0;

  let readiness = 100;
  readiness -= profile.missingPct * 1.0;
  readiness -= profile.dupPct * 1.5;
  readiness -= Math.min(invalidPct * 2, 20);
  readiness -= Math.min(straightLinerPct * 1.5, 20);
  if (n < 30) readiness -= 20;
  else if (n < 100) readiness -= 10;
  const readinessScore = Math.max(0, Math.round(readiness));
  const readinessBand =
    readinessScore >= 90 ? "Ready for Analysis"
    : readinessScore >= 75 ? "Minor Cleaning Recommended"
    : readinessScore >= 60 ? "Significant Data Issues"
    : "Review Dataset Before Analysis";

  // ---- Statistical Readiness Assessment ----
  const numericCount = profile.numericCount;
  const lowMissing = profile.missingPct < 10;
  const twoGroup = groupingVars.some((g) => g.groups === 2);
  const multiGroup = groupingVars.some((g) => g.groups >= 3);

  const statTests: StatTest[] = [
    {
      name: "Descriptive Statistics", suitable: n >= 1,
      note: n >= 30 ? "Sample size is adequate for descriptive reporting."
        : "Usable, but small samples limit how far results generalize.",
    },
    {
      name: "Correlation Analysis", suitable: numericCount >= 2 && n >= 30,
      note: numericCount < 2 ? "Needs at least two numeric variables."
        : n < 30 ? "Sample under 30 — correlations may be unstable."
        : "Two or more numeric variables present.",
    },
    {
      name: "Regression Analysis", suitable: numericCount >= 2 && n >= 50 && lowMissing,
      note: numericCount < 2 ? "Needs a numeric outcome and predictor(s)."
        : n < 50 ? "Recommended n ≥ 50 for stable estimates."
        : !lowMissing ? "Address missing values before modeling."
        : "Adequate sample and complete data for modeling.",
    },
    {
      name: "T-Test", suitable: twoGroup && numericCount >= 1 && n >= 30,
      note: !twoGroup ? "Needs a grouping variable with exactly two groups."
        : numericCount < 1 ? "Needs a numeric outcome."
        : "Two-group variable and numeric outcome available.",
    },
    {
      name: "ANOVA", suitable: multiGroup && numericCount >= 1 && n >= 30,
      note: !multiGroup ? "Needs a grouping variable with three or more groups."
        : numericCount < 1 ? "Needs a numeric outcome."
        : "Multi-group variable and numeric outcome available.",
    },
  ];

  // ---- Correlation matrix (Pearson, numeric columns with variance) ----
  const correlations = computeCorrelations(rows, profile);

  return {
    readinessScore, readinessBand,
    validResponses: Math.max(0, n - profile.duplicates),
    likert, invalidFlags,
    straightLiners, straightLinerPct,
    lowVariance, lowVariancePct,
    statTests, groupingVars,
    invalidRows: [...invalidRowSet].sort((a, b) => a - b),
    straightLinerRows,
    correlations,
  };
}

// Pearson correlation across numeric columns that actually vary.
function computeCorrelations(rows: Row[], profile: DatasetProfile): CorrelationMatrix | null {
  const numeric = profile.columns.filter((c) => c.stats && c.stats.std > 0);
  if (numeric.length < 2) return null;
  const cols = numeric.map((c) => c.name);

  // paired numeric series per column (NaN where missing/non-numeric)
  const series = cols.map((name) =>
    rows.map((r) => {
      const v = asNumber(r[name]);
      return v === null ? NaN : v;
    })
  );

  const pearson = (a: number[], b: number[]): number | null => {
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < a.length; i++) {
      if (!Number.isNaN(a[i]) && !Number.isNaN(b[i])) { xs.push(a[i]); ys.push(b[i]); }
    }
    if (xs.length < 3) return null;
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
    const my = ys.reduce((s, v) => s + v, 0) / ys.length;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < xs.length; i++) {
      const a2 = xs[i] - mx, b2 = ys[i] - my;
      num += a2 * b2; dx += a2 * a2; dy += b2 * b2;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  };

  const matrix = cols.map((_, i) =>
    cols.map((__, j) => (i === j ? 1 : pearson(series[i], series[j])))
  );
  return { columns: cols, matrix };
}

// Methodology drafts filled with the dataset's real numbers.
export function methodologyDrafts(p: DatasetProfile, r: ResearchReport) {
  const screened: string[] = ["duplicate entries", "missing values"];
  if (r.invalidFlags.length) screened.push("invalid responses");
  if (r.straightLiners > 0) screened.push("straight-lined responses");
  const screenList = screened.slice(0, -1).join(", ") + ", and " + screened[screened.length - 1];

  return [
    {
      title: "Data Cleaning Procedure",
      text: `Prior to analysis, the dataset (N = ${p.rows}) was screened for ${screenList}. ` +
        `${p.duplicates} duplicate record${p.duplicates === 1 ? "" : "s"} ` +
        `(${p.dupPct.toFixed(1)}% of responses) ${p.duplicates === 1 ? "was" : "were"} identified, ` +
        `and ${p.totalMissing} missing value${p.totalMissing === 1 ? "" : "s"} ` +
        `(${p.missingPct.toFixed(1)}% of all cells) ${p.totalMissing === 1 ? "was" : "were"} recorded. ` +
        `Records failing validation checks were reviewed and addressed prior to statistical analysis.`,
    },
    {
      title: "Dataset Description",
      text: `The final dataset consisted of ${r.validResponses} valid response${r.validResponses === 1 ? "" : "s"} ` +
        `across ${p.cols} variable${p.cols === 1 ? "" : "s"} after data screening and validation procedures. ` +
        (r.likert.length
          ? `${r.likert.length} item${r.likert.length === 1 ? " was" : "s were"} measured on Likert-type scales. `
          : "") +
        `The dataset achieved a research-readiness assessment of ${r.readinessScore}/100 (${r.readinessBand}).`,
    },
  ];
}

// Combined compact object for the AI Research Reviewer.
export function researchForAI(p: DatasetProfile, r: ResearchReport) {
  return {
    rows: p.rows, validResponses: r.validResponses, columns: p.cols,
    qualityScore: p.score, researchReadinessScore: r.readinessScore, readinessBand: r.readinessBand,
    missingPctOverall: +p.missingPct.toFixed(2),
    duplicateRows: p.duplicates, duplicatePct: +p.dupPct.toFixed(2),
    likertItems: r.likert.map((l) => ({
      name: l.name, scale: `1-${l.scale}`,
      mean: +l.mean.toFixed(2), std: +l.std.toFixed(2),
    })),
    integrityFlags: r.invalidFlags.map((f) => ({ column: f.column, issue: f.issue, count: f.count })),
    straightLiners: r.straightLiners,
    lowVarianceResponses: r.lowVariance,
    statisticalReadiness: r.statTests.map((t) => ({ test: t.name, suitable: t.suitable })),
    columns_detail: p.columns.map((c) => ({
      name: c.name, type: c.type, missingPct: +c.missingPct.toFixed(1),
      ...(c.stats ? { mean: +c.stats.mean.toFixed(2), std: +c.stats.std.toFixed(2), outliers: c.stats.outlierCount } : {}),
    })),
  };
}

/* ===================== Data cleaning ("fix it") ===================== */
export interface CleanOptions {
  dedupe: boolean;
  removeInvalid: boolean;
  removeStraightLiners: boolean;
  missing: "none" | "drop" | "impute";
}

export interface CleanResult {
  rows: Row[];
  fields: string[];
  log: string[];
  before: number;
  after: number;
}

// Apply the selected cleaning steps and return a new, cleaned dataset + a log.
// Order: dedupe -> remove invalid rows -> remove straight-liners -> handle missing.
export function cleanDataset(
  rows: Row[], fields: string[], profile: DatasetProfile,
  research: ResearchReport, opts: CleanOptions
): CleanResult {
  const before = rows.length;
  const log: string[] = [];
  let keep = rows.map((r, i) => ({ r, i })); // carry original index

  if (opts.dedupe) {
    const seen = new Set<string>();
    const next = keep.filter(({ r }) => {
      const key = JSON.stringify(fields.map((f) => r[f]));
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    if (before && next.length < keep.length) log.push(`Removed ${keep.length - next.length} duplicate row(s).`);
    keep = next;
  }

  if (opts.removeInvalid && research.invalidRows.length) {
    const bad = new Set(research.invalidRows);
    const n0 = keep.length;
    keep = keep.filter(({ i }) => !bad.has(i));
    log.push(`Removed ${n0 - keep.length} row(s) containing invalid values.`);
  }

  if (opts.removeStraightLiners && research.straightLinerRows.length) {
    const bad = new Set(research.straightLinerRows);
    const n0 = keep.length;
    keep = keep.filter(({ i }) => !bad.has(i));
    log.push(`Removed ${n0 - keep.length} straight-lined response(s).`);
  }

  let out: Row[] = keep.map(({ r }) => ({ ...r }));

  if (opts.missing === "drop") {
    const n0 = out.length;
    out = out.filter((r) => fields.every((f) => !isMissing(r[f])));
    log.push(`Dropped ${n0 - out.length} row(s) with missing values.`);
  } else if (opts.missing === "impute") {
    const medians = new Map<string, number>();
    for (const c of profile.columns) if (c.stats) medians.set(c.name, c.stats.median);
    let filled = 0;
    for (const r of out) {
      for (const f of fields) {
        if (isMissing(r[f]) && medians.has(f)) {
          r[f] = String(medians.get(f)); filled++;
        }
      }
    }
    log.push(`Imputed ${filled} missing numeric value(s) with the column median.`);
  }

  if (!log.length) log.push("No changes applied — select at least one cleaning option.");
  return { rows: out, fields, log, before, after: out.length };
}

// Serialize cleaned rows back to CSV (RFC-4180 quoting).
export function toCSV(rows: Row[], fields: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = fields.map(esc).join(",");
  const body = rows.map((r) => fields.map((f) => esc(r[f])).join(",")).join("\n");
  return header + "\n" + body;
}

/* ===================== Downloadable report ===================== */
export function buildReportMarkdown(
  meta: { name: string; rows: number; cols: number },
  p: DatasetProfile, r: ResearchReport,
  drafts: { title: string; text: string }[],
  aiReport: string | null
): string {
  const L: string[] = [];
  L.push(`# Himay Data Validation Report`);
  L.push(`**Dataset:** ${meta.name}  `);
  L.push(`**Generated:** ${new Date().toLocaleString()}`);
  L.push("");
  L.push(`## Scores`);
  L.push(`- **Himay Score (data quality):** ${p.score}/100 — ${p.grade}`);
  L.push(`- **Research Readiness:** ${r.readinessScore}/100 — ${r.readinessBand}`);
  L.push("");
  L.push(`## Overview`);
  L.push(`- Rows: ${p.rows}`);
  L.push(`- Valid responses (after de-duplication): ${r.validResponses}`);
  L.push(`- Columns: ${p.cols}`);
  L.push(`- Missing values: ${p.totalMissing} (${p.missingPct.toFixed(1)}%)`);
  L.push(`- Duplicate rows: ${p.duplicates} (${p.dupPct.toFixed(1)}%)`);
  L.push(`- Likert items detected: ${r.likert.length}`);
  L.push("");
  L.push(`## Survey Integrity`);
  L.push(`- Straight-lined responses: ${r.likert.length >= 3 ? r.straightLiners : "n/a"}`);
  L.push(`- Low-variance responses: ${r.likert.length >= 3 ? r.lowVariance : "n/a"}`);
  if (r.invalidFlags.length) {
    L.push(`- Invalid-value flags:`);
    r.invalidFlags.forEach((f) => L.push(`  - ${f.column}: ${f.issue} (${f.count}; e.g. ${f.examples.join(", ")})`));
  } else {
    L.push(`- No invalid values detected.`);
  }
  L.push("");
  if (r.likert.length) {
    L.push(`## Likert Items`);
    r.likert.forEach((l) => L.push(`- ${l.name} (1–${l.scale}): mean ${l.mean.toFixed(2)}, median ${l.median}, SD ${l.std.toFixed(2)}`));
    L.push("");
  }
  L.push(`## Statistical Readiness`);
  r.statTests.forEach((t) => L.push(`- ${t.suitable ? "✓" : "✗"} **${t.name}** — ${t.note}`));
  L.push("");
  if (aiReport) {
    L.push(`## AI Research Review`);
    L.push(aiReport.trim());
    L.push("");
  }
  if (drafts.length) {
    L.push(`## Methodology Drafts`);
    drafts.forEach((d) => { L.push(`### ${d.title}`); L.push(d.text); L.push(""); });
  }
  L.push(`---`);
  L.push(`*Generated by Himay — validate your data before you trust it.*`);
  return L.join("\n");
}
