export type EvaluationOption = {
  key: string;
  label: string;
  normalized: string;
  compact: string;
};

export function normalizeEvaluationText(value: any): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeEvaluationKey(label: string, index: number): string {
  const compact = normalizeEvaluationText(label).replace(/\s+/g, "_");
  return compact || `option_${index + 1}`;
}

function parseStoredOptions(raw: any): string[] {
  if (Array.isArray(raw))
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof raw !== "string") return [];
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed))
      return parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
  } catch {
    // Backward compatibility for comma-separated values.
  }
  return text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function getDefaultEvaluationLabels(
  voteType?: string | null,
  voteRule?: string | null,
): string[] {
  if (voteType !== "trust") return [];
  if (voteRule === "trust-3-level")
    return ["Tín nhiệm cao", "Tín nhiệm", "Tín nhiệm thấp"];
  return ["Đồng ý", "Không đồng ý"];
}

export function buildEvaluationOptions(
  raw: any,
  voteType?: string | null,
  voteRule?: string | null,
): EvaluationOption[] {
  const labels = parseStoredOptions(raw);
  const finalLabels =
    labels.length > 0 ? labels : getDefaultEvaluationLabels(voteType, voteRule);
  const seen = new Set<string>();
  return finalLabels
    .map((label, index) => {
      const normalized = normalizeEvaluationText(label);
      const compact = normalized.replace(/\s+/g, "");
      return {
        key: makeEvaluationKey(label, index),
        label,
        normalized,
        compact,
      };
    })
    .filter((opt) => {
      if (!opt.normalized || seen.has(opt.compact)) return false;
      seen.add(opt.compact);
      return true;
    });
}

function parseBool(value: any): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = normalizeEvaluationText(value).replace(/\s+/g, "-");
    return [
      "true",
      "1",
      "yes",
      "y",
      "co",
      "x",
      "marked",
      "selected",
      "chon",
      "danh-dau",
    ].includes(v);
  }
  return false;
}

const POSITIVE_ALIASES = [
  "dong y",
  "tan thanh",
  "co",
  "agree",
  "yes",
  "approve",
  "chap thuan",
];
const NEGATIVE_ALIASES = [
  "khong dong y",
  "khong tan thanh",
  "khong",
  "disagree",
  "no",
  "reject",
  "phan doi",
];
const HIGH_ALIASES = [
  "tin nhiem cao",
  "cao",
  "high",
  "high trust",
  "trust high",
  "tn cao",
];
const MEDIUM_ALIASES = [
  "tin nhiem",
  "tin nhiem vua",
  "trung binh",
  "medium",
  "normal",
  "trust",
  "tn",
];
const LOW_ALIASES = [
  "tin nhiem thap",
  "thap",
  "low",
  "low trust",
  "trust low",
  "tn thap",
];

function matchesAny(label: EvaluationOption, aliases: string[]) {
  return aliases.some(
    (alias) => label.normalized === normalizeEvaluationText(alias),
  );
}

function optionFromText(
  value: any,
  options: EvaluationOption[],
): EvaluationOption | null {
  const normalized = normalizeEvaluationText(value);
  if (!normalized) return null;
  const compact = normalized.replace(/\s+/g, "");
  return (
    options.find(
      (opt) => opt.normalized === normalized || opt.compact === compact,
    ) || null
  );
}

export function extractEvaluationOption(
  row: any,
  options: EvaluationOption[],
): EvaluationOption | null {
  if (!row || typeof row !== "object" || options.length === 0) return null;

  const direct = optionFromText(
    row.evaluation ??
      row.evaluationLabel ??
      row.evaluation_label ??
      row.choice ??
      row.result ??
      row.value ??
      row.rating ??
      row.level ??
      row.trustLevel ??
      row.trust_level,
    options,
  );
  if (direct) return direct;

  const marked = options.filter((opt) => {
    const candidateKeys = [
      opt.label,
      opt.key,
      opt.normalized,
      opt.compact,
      opt.normalized.replace(/\s+/g, "_"),
      opt.normalized.replace(/\s+/g, "-"),
    ];
    return candidateKeys.some((key) => parseBool(row[key]));
  });
  if (marked.length === 1) return marked[0];

  const legacyMarks: EvaluationOption[] = [];
  const agree = parseBool(row.agree);
  const disagree = parseBool(row.disagree);
  const high =
    parseBool(row.trustHigh) ||
    parseBool(row.trust_high) ||
    parseBool(row.highTrust) ||
    parseBool(row.high_trust) ||
    parseBool(row.tinNhiemCao) ||
    parseBool(row.tin_nhiem_cao) ||
    parseBool(row.high);
  const medium =
    parseBool(row.trustMedium) ||
    parseBool(row.trust_medium) ||
    parseBool(row.mediumTrust) ||
    parseBool(row.medium_trust) ||
    parseBool(row.tinNhiem) ||
    parseBool(row.tin_nhiem) ||
    parseBool(row.medium);
  const low =
    parseBool(row.trustLow) ||
    parseBool(row.trust_low) ||
    parseBool(row.lowTrust) ||
    parseBool(row.low_trust) ||
    parseBool(row.tinNhiemThap) ||
    parseBool(row.tin_nhiem_thap) ||
    parseBool(row.low);

  const positiveOpt = options.find((opt) => matchesAny(opt, POSITIVE_ALIASES));
  const negativeOpt = options.find((opt) => matchesAny(opt, NEGATIVE_ALIASES));
  const highOpt = options.find((opt) => matchesAny(opt, HIGH_ALIASES));
  const mediumOpt = options.find((opt) => matchesAny(opt, MEDIUM_ALIASES));
  const lowOpt = options.find((opt) => matchesAny(opt, LOW_ALIASES));

  if (agree && !disagree && positiveOpt) legacyMarks.push(positiveOpt);
  if (disagree && !agree && negativeOpt) legacyMarks.push(negativeOpt);
  if (high && highOpt) legacyMarks.push(highOpt);
  if (medium && mediumOpt) legacyMarks.push(mediumOpt);
  if (low && lowOpt) legacyMarks.push(lowOpt);

  const unique = Array.from(
    new Map(legacyMarks.map((opt) => [opt.key, opt])).values(),
  );
  return unique.length === 1 ? unique[0] : null;
}
