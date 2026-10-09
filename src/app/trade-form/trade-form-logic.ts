// Pure helpers for the New / Edit trade steps

export const FORM_STEPS = [
  { label: 'Essentials', hint: 'Prices, stop, result' },
  { label: 'Execution', hint: 'Session, rules, mind' },
  { label: 'Review', hint: 'Charts, questions, score' },
] as const;

// Session from an entry time (HH:MM, New York time), or '' when it falls outside them
export function suggestSession(entryTime: string | null | undefined): string {
  if (!entryTime || !/^\d{2}:\d{2}/.test(entryTime)) return '';
  const [h, m] = entryTime.split(':').map(Number);
  const minutes = h * 60 + m;
  if (minutes >= 18 * 60 || minutes < 2 * 60) return 'Asian';
  if (minutes < 9 * 60) return 'London';
  if (minutes < 12 * 60) return 'New York AM';
  if (minutes < 17 * 60) return 'New York PM';
  return '';
}

// ---------- trade quality score ----------

const GRADE_POINTS: Record<string, number> = {
  'A+': 10,
  A: 9,
  'B+': 7,
  B: 6,
  'C+': 4,
  C: 3,
  D: 1,
  F: 0,
};

export interface ScorePart {
  label: string;
  earned: number;
  max: number;
}

export interface QualityScore {
  score: number; // 0-100, out of the parts that could be scored
  label: string;
  parts: ScorePart[]; // parts without data (no rules, no stop...) are left out
}

export interface ScoreInput {
  rulesFollowed: number;
  rulesTotal: number;
  mistakes: number;
  rMultiple: number | null; // null = no stop logged
  answersYes: number;
  answersTotal: number;
  grade: string;
}

// How well the trade was executed, not whether it made money:
// rules 35 · no mistakes 25 · stop respected 15 · review answers 15 · grade 10.
export function qualityScore(input: ScoreInput): QualityScore {
  const parts: ScorePart[] = [];
  if (input.rulesTotal > 0) {
    parts.push({
      label: 'Rules',
      earned: Math.round((35 * input.rulesFollowed) / input.rulesTotal),
      max: 35,
    });
  }
  parts.push({
    label: 'No mistakes',
    earned: input.mistakes === 0 ? 25 : input.mistakes === 1 ? 10 : 0,
    max: 25,
  });
  if (input.rMultiple !== null) {
    parts.push({ label: 'Stop respected', earned: input.rMultiple >= -1.05 ? 15 : 0, max: 15 });
  }
  if (input.answersTotal > 0) {
    parts.push({
      label: 'Review answers',
      earned: Math.round((15 * input.answersYes) / input.answersTotal),
      max: 15,
    });
  }
  if (input.grade in GRADE_POINTS) {
    parts.push({ label: `Grade ${input.grade}`, earned: GRADE_POINTS[input.grade], max: 10 });
  }
  const earned = parts.reduce((s, p) => s + p.earned, 0);
  const max = parts.reduce((s, p) => s + p.max, 0);
  const score = max > 0 ? Math.round((earned / max) * 100) : 0;
  const label =
    score >= 85
      ? 'Strong execution'
      : score >= 65
        ? 'Good execution'
        : score >= 45
          ? 'Mixed execution'
          : 'Poor execution';
  return { score, label, parts };
}

// ---------- fees remembered per symbol ----------

const feeKey = (symbol: string) => `feePerContract:${symbol}`;

export function rememberedFee(symbol: string): number | null {
  try {
    const value = Number(localStorage.getItem(feeKey(symbol)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function rememberFee(symbol: string, totalFees: number, contracts: number) {
  if (!(contracts > 0) || !(totalFees > 0)) return;
  try {
    localStorage.setItem(feeKey(symbol), String(Math.round((totalFees / contracts) * 100) / 100));
  } catch {
    // remembering the fee is only a convenience
  }
}
