import { ReportTab } from '../reports/report-logic';
import { EdgeAnalytics } from './edge-analytics';
import { MistakeCost } from '../mistakes/mistakes';

// One finding on the dashboard that links into the Reports tab explaining it
export interface Highlight {
  label: string;
  value: string;
  amount: number | null; // signed P/L shown next to the detail, if any
  detail: string;
  tab: ReportTab;
}

interface RuleStats {
  followedAllPercentage: number;
  followedTradesCount: number;
  totalTradesWithRules: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Only findings with enough data to mean something are shown
export function buildHighlights(
  edge: EdgeAnalytics,
  cost: MistakeCost,
  rules: RuleStats | null,
): Highlight[] {
  const out: Highlight[] = [];
  const emotion = edge.costliestEmotion;
  if (emotion) {
    out.push({
      label: 'Costliest emotion',
      value: emotion.key,
      amount: emotion.net,
      detail: plural(emotion.total, 'trade'),
      tab: 'psychology',
    });
  }
  const hour = edge.bestHour;
  if (hour) {
    out.push({
      label: 'Best entry hour',
      value: `${hour.key}:00`,
      amount: null,
      detail: `${hour.winRate}% win · ${plural(hour.total, 'trade')}`,
      tab: 'timing',
    });
  }
  const mistake = cost.rows[0];
  if (mistake && mistake.net < 0) {
    out.push({
      label: 'Most expensive mistake',
      value: mistake.name,
      amount: mistake.net,
      detail: plural(mistake.count, 'trade'),
      tab: 'discipline',
    });
  }
  if (rules && rules.totalTradesWithRules > 0) {
    out.push({
      label: 'Followed all rules',
      value: `${rules.followedAllPercentage}%`,
      amount: null,
      detail: `${rules.followedTradesCount} of ${plural(rules.totalTradesWithRules, 'trade')}`,
      tab: 'discipline',
    });
  }
  return out;
}
