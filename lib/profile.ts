// Client-side data profiling engine — no backend required.

export type ColumnType = "Numeric" | "Text" | "Boolean" | "Date";
export type Row = Record<string, string>;

export interface NumericStats {
  mean: number; median: number; min: number; max: number; std: number;
  q1: number; q3: number; lowerBound: number; upperBound: number;
  outlierCount: number; outlierPct: number; outlierSamples: number[];
  values: number[];
}

export interface ColumnProfile {
  name: string; type: ColumnType;
  missing: number; missingPct: number; unique: number;
  stats?: NumericStats;
  topValues?: [string, number][];
}

export interface DatasetProfile {
  rows: number; cols: number;
  totalMissing: number; missingPct: number;
  duplicates: number; dupPct: number; dupSamples: number[];
  numericCount: number; textCount: number;
  score: number; grade: string;
  columns: ColumnProfile[];
}

const isMissing = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

const asNumber = (v: unknown): number | null => {
  const s = String(v).trim();
  if (!/^-?[\d,.]+$/.test(s)) return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const BOOL_SET = new Set(["true", "false", "yes", "no", "0", "1", "t", "f"]);

function inferType(values: string[]): ColumnType {
  const present = values.filter((v) => !isMissing(v));
  if (!present.length) return "Text";
  const sample = present.slice(0, 500);
  const ratio = (fn: (v: string) => boolean) => sample.filter(fn).length / sample.length;
  if (
    ratio((v) => BOOL_SET.has(v.trim().toLowerCase())) > 0.95 &&
    new Set(sample.map((v) => v.toLowerCase())).size <= 2
  ) return "Boolean";
  if (ratio((v) => asNumber(v) !== null) > 0.8) return "Numeric";
  if (ratio((v) => !isNaN(Date.parse(v)) && /[-/:]/.test(v)) > 0.8) return "Date";
  return "Text";
}

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export function profileDataset(rows: Row[], fields: string[]): DatasetProfile {
  const n = rows.length;

  const columns: ColumnProfile[] = fields.map((name) => {
    const values = rows.map((r) => r[name]);
    const missing = values.filter(isMissing).length;
    const type = inferType(values);
    const unique = new Set(values.filter((v) => !isMissing(v)).map(String)).size;
    const col: ColumnProfile = { name, type, missing, missingPct: n ? (missing / n) * 100 : 0, unique };

    if (type === "Numeric") {
      const nums = values
        .map(asNumber)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
      if (nums.length) {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const std = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
        const q1 = quantile(nums, 0.25), q3 = quantile(nums, 0.75), iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr, upperBound = q3 + 1.5 * iqr;
        const outliers = nums.filter((v) => v < lowerBound || v > upperBound);
        col.stats = {
          mean, median: quantile(nums, 0.5), min: nums[0], max: nums[nums.length - 1],
          std, q1, q3, lowerBound, upperBound,
          outlierCount: outliers.length,
          outlierPct: (outliers.length / nums.length) * 100,
          outlierSamples: [...new Set(outliers)].slice(0, 5),
          values: nums,
        };
      }
    } else {
      const freq: Record<string, number> = {};
      for (const v of values) if (!isMissing(v)) freq[String(v)] = (freq[String(v)] || 0) + 1;
      col.topValues = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    }
    return col;
  });

  // exact duplicate rows
  const seen = new Set<string>();
  let duplicates = 0;
  const dupSamples: number[] = [];
  rows.forEach((r, i) => {
    const key = JSON.stringify(fields.map((f) => r[f]));
    if (seen.has(key)) {
      duplicates++;
      if (dupSamples.length < 3) dupSamples.push(i);
    } else seen.add(key);
  });

  const totalCells = n * fields.length;
  const totalMissing = columns.reduce((a, c) => a + c.missing, 0);
  const missingPct = totalCells ? (totalMissing / totalCells) * 100 : 0;
  const dupPct = n ? (duplicates / n) * 100 : 0;
  const numericCols = columns.filter((c) => c.type === "Numeric");
  const avgOutlierPct = numericCols.length
    ? numericCols.reduce((a, c) => a + (c.stats?.outlierPct || 0), 0) / numericCols.length
    : 0;

  const score = Math.max(0, Math.round(
    100 - missingPct * 1.2 - dupPct * 1.5 - Math.min(avgOutlierPct, 15) * 0.8
  ));
  const grade =
    score >= 95 ? "Excellent" : score >= 80 ? "Good" : score >= 60 ? "Fair" : "Needs Attention";

  return {
    rows: n, cols: fields.length, totalMissing, missingPct,
    duplicates, dupPct, dupSamples,
    numericCount: numericCols.length,
    textCount: columns.filter((c) => c.type !== "Numeric").length,
    score, grade, columns,
  };
}

// Compact profile sent to the AI insight endpoint (omits raw values).
export function profileForAI(p: DatasetProfile) {
  return {
    rows: p.rows, columns: p.cols, qualityScore: p.score, grade: p.grade,
    missingPctOverall: +p.missingPct.toFixed(2),
    duplicateRows: p.duplicates, duplicatePct: +p.dupPct.toFixed(2),
    perColumn: p.columns.map((c) => ({
      name: c.name, type: c.type,
      missingPct: +c.missingPct.toFixed(1), unique: c.unique,
      ...(c.stats
        ? {
            mean: +c.stats.mean.toFixed(2), median: +c.stats.median.toFixed(2),
            min: c.stats.min, max: c.stats.max, std: +c.stats.std.toFixed(2),
            outliers: c.stats.outlierCount,
          }
        : { topValue: c.topValues?.[0]?.[0] }),
    })),
  };
}
