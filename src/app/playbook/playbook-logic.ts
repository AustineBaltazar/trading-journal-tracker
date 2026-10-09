import { MistakeCost } from '../mistakes/mistakes';

export const RULE_CATEGORIES = ['Entry', 'Setup', 'Risk', 'Market'] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export interface RuleStat {
  ruleId: number;
  name: string;
  total: number;
  followedCount: number;
  percentage: number;
  avgPnlFollowed: number | null;
  avgPnlBroken: number | null;
}

export interface RuleStats {
  adherence: RuleStat[];
  followedAllPercentage: number;
  followedTradesCount: number;
  totalTradesWithRules: number;
  avgPnlRulesFollowed: number;
  avgPnlRuleBroken: number;
}

export interface QuestionStat {
  id: number;
  question_text: string;
  total: number;
  yes: number;
  no: number;
  other: number;
}

export interface QuestionStats {
  questions: QuestionStat[];
  tradesAnswered: number;
  tradesAllYes: number;
}

// The rule followed least often (needs at least one trade)
export function weakestRule(rules: RuleStat[]): RuleStat | null {
  return rules
    .filter((r) => r.total > 0)
    .reduce<RuleStat | null>((w, r) => (!w || r.percentage < w.percentage ? r : w), null);
}

// The question answered "Yes" least often (needs at least one answer)
export function weakestQuestion(questions: QuestionStat[]): QuestionStat | null {
  return questions
    .filter((q) => q.total > 0)
    .reduce<QuestionStat | null>((w, q) => (!w || q.yes / q.total < w.yes / w.total ? q : w), null);
}

export type Impact = 'high' | 'medium' | 'low' | 'none' | 'unused';

export interface MistakeRow {
  id: number;
  name: string;
  count: number;
  net: number;
  impact: Impact;
}

// Every mistake on the list, most expensive first, unused ones last.
// Impact = this mistake's share of everything mistakes cost.
export function mistakeRows(cost: MistakeCost, all: { id: number; name: string }[]): MistakeRow[] {
  const lossTotal = -cost.rows.filter((r) => r.net < 0).reduce((s, r) => s + r.net, 0);
  const used = cost.rows.map((r) => {
    let impact: Impact = 'none';
    if (r.net < 0 && lossTotal > 0) {
      const share = -r.net / lossTotal;
      impact = share >= 0.3 ? 'high' : share >= 0.1 ? 'medium' : 'low';
    }
    return { id: r.id, name: r.name, count: r.count, net: r.net, impact };
  });
  const usedIds = new Set(used.map((r) => r.id));
  const unused = all
    .filter((m) => !usedIds.has(m.id))
    .map((m) => ({ id: m.id, name: m.name, count: 0, net: 0, impact: 'unused' as Impact }));
  return [...used, ...unused];
}
