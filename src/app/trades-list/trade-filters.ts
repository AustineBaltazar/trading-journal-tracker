import { emotionsOf, OutcomeFields, outcomeOf, winRate } from '../outcome';
import { GRADES } from '../trade-journal';

export type Outcome = 'all' | 'wins' | 'losses' | 'be';
const OUTCOME_FILTER = { wins: 'win', losses: 'loss', be: 'be' } as const;
export type SortKey = 'date' | 'grade' | 'pnl';
export type SortDir = 'asc' | 'desc';

export interface TradeFilters {
  search: string;
  outcome: Outcome;
  session: string; // '' = any
  emotion: string;
  grade: string;
  rulesBrokenOnly: boolean;
  // '' = any, 'clean' = no mistakes, 'any' = at least one, or a mistake id
  mistake: string;
}

export const NO_FILTERS: TradeFilters = {
  search: '',
  outcome: 'all',
  session: '',
  emotion: '',
  grade: '',
  rulesBrokenOnly: false,
  mistake: '',
};

function matchesMistake(mistakeIds: number[] | undefined, filter: string): boolean {
  const ids = mistakeIds || [];
  if (!filter) return true;
  if (filter === 'clean') return ids.length === 0;
  if (filter === 'any') return ids.length > 0;
  return ids.includes(Number(filter));
}

export function filterTrades<T extends Record<string, any>>(trades: T[], f: TradeFilters): T[] {
  const search = f.search.toLowerCase().trim();
  return trades.filter(
    (t) =>
      (!search || (t['strategy'] || '').toLowerCase().includes(search)) &&
      (f.outcome === 'all' || outcomeOf(t as any) === OUTCOME_FILTER[f.outcome]) &&
      (!f.session || t['session'] === f.session) &&
      (!f.emotion || emotionsOf(t).includes(f.emotion)) &&
      (!f.grade || t['grade'] === f.grade) &&
      (!f.rulesBrokenOnly || t['rulesFollowed'] === false) &&
      matchesMistake(t['mistakeIds'], f.mistake),
  );
}

const gradeRank = (grade: string | null | undefined) => {
  const i = grade ? GRADES.indexOf(grade) : -1;
  return i < 0 ? null : i;
};

// Sorts a copy. "asc" grade means A+ first. Trades without a grade always go last.
// Ties fall back to newest date first, then highest id.
export function sortTrades<T extends Record<string, any>>(
  trades: T[],
  key: SortKey,
  dir: SortDir,
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  const byNewest = (a: T, b: T) =>
    b['trade_date'].localeCompare(a['trade_date']) ||
    (b['entry_time'] || '').localeCompare(a['entry_time'] || '') ||
    b['id'] - a['id'];

  return [...trades].sort((a, b) => {
    if (key === 'grade') {
      const ga = gradeRank(a['grade']);
      const gb = gradeRank(b['grade']);
      if (ga === null || gb === null) return ga === gb ? byNewest(a, b) : ga === null ? 1 : -1;
      return (ga - gb) * sign || byNewest(a, b);
    }
    if (key === 'pnl') return (a['netPnl'] - b['netPnl']) * sign || byNewest(a, b);
    return -byNewest(a, b) * sign;
  });
}

export interface TradeSummary {
  total: number;
  wins: number;
  losses: number;
  breakEvens: number;
  netPnl: number;
  winRate: number;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Counts and averages use the outcome (so a BE is neither a win nor a loss);
// profit factor stays about money: all positive P/L over all negative P/L.
export function summarizeTrades(trades: OutcomeFields[]): TradeSummary {
  const winners = trades.filter((t) => outcomeOf(t) === 'win');
  const losers = trades.filter((t) => outcomeOf(t) === 'loss');
  const sum = (list: OutcomeFields[]) => list.reduce((s, t) => s + t.netPnl, 0);
  const grossWin = sum(trades.filter((t) => t.netPnl > 0));
  const grossLoss = Math.abs(sum(trades.filter((t) => t.netPnl < 0)));
  return {
    total: trades.length,
    wins: winners.length,
    losses: losers.length,
    breakEvens: trades.length - winners.length - losers.length,
    netPnl: round2(sum(trades)),
    winRate: winRate(winners.length, losers.length),
    avgWin: winners.length ? round2(sum(winners) / winners.length) : null,
    avgLoss: losers.length ? round2(sum(losers) / losers.length) : null,
    profitFactor: grossLoss > 0 ? round2(grossWin / grossLoss) : null,
  };
}
