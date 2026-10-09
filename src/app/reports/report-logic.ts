import { OutcomeFields, outcomeOf, winRate } from '../outcome';

export type RangeKey = 'month' | '30d' | '3m' | 'all' | 'custom';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

export const REPORT_TABS = ['timing', 'psychology', 'discipline'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

// Inclusive YYYY-MM-DD bounds; null = open-ended
export interface DateRange {
  from: string | null;
  to: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDate(date: string, { days = 0, months = 0 }: { days?: number; months?: number }) {
  const [y, m, d] = date.split('-').map(Number);
  const out = new Date(0);
  // setUTCFullYear keeps years 0-99 as written (Date.UTC would map them to 1900s)
  out.setUTCFullYear(y, m - 1 + months, d + days);
  return out.toISOString().slice(0, 10);
}

export function isRangeKey(value: unknown): value is RangeKey {
  return RANGE_OPTIONS.some((o) => o.key === value);
}

// The dates a range covers, counted back from today (local YYYY-MM-DD)
export function rangeDates(
  key: RangeKey,
  today: string,
  custom: DateRange = { from: null, to: null },
): DateRange {
  switch (key) {
    case 'month':
      return { from: today.slice(0, 8) + '01', to: today };
    case '30d':
      return { from: shiftDate(today, { days: -29 }), to: today };
    case '3m':
      return { from: shiftDate(today, { months: -3, days: 1 }), to: today };
    case 'custom': {
      const from = custom.from && DATE.test(custom.from) ? custom.from : null;
      const to = custom.to && DATE.test(custom.to) ? custom.to : null;
      // A backwards range is read the right way round
      return from && to && from > to ? { from: to, to: from } : { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

export function tradesInRange<T extends { trade_date: string }>(
  trades: T[],
  range: DateRange,
): T[] {
  return trades.filter((t) => {
    const date = t.trade_date.slice(0, 10);
    return (!range.from || date >= range.from) && (!range.to || date <= range.to);
  });
}

export interface DayStats {
  name: string;
  total: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
  net: number;
}

// Mon-Fri stats. Win rate matches /trades/summary: wins / (wins + losses),
// break-evens are counted on their own. Weekend-dated trades aren't shown.
export function buildDayOfWeek(trades: (OutcomeFields & { trade_date: string })[]): DayStats[] {
  const days: DayStats[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((name) => ({
    name,
    total: 0,
    wins: 0,
    losses: 0,
    breakEvens: 0,
    winRate: 0,
    net: 0,
  }));
  for (const trade of trades) {
    const [year, month, day] = trade.trade_date.substring(0, 10).split('-').map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const stats = days[weekday - 1];
    stats.total += 1;
    stats.net += trade.netPnl;
    const outcome = outcomeOf(trade);
    if (outcome === 'win') stats.wins += 1;
    else if (outcome === 'loss') stats.losses += 1;
    else stats.breakEvens += 1;
  }
  return days.map((d) => ({
    ...d,
    net: Math.round(d.net * 100) / 100,
    winRate: winRate(d.wins, d.losses),
  }));
}
