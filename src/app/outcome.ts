// Win / loss / break-even, matching the API's utils/outcome.js.
export type TradeOutcome = 'win' | 'loss' | 'be';

export const RESULT_OPTIONS: { value: TradeOutcome; label: string }[] = [
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'be', label: 'BE' },
];

export interface OutcomeFields {
  netPnl: number;
  outcome?: TradeOutcome | null;
  result?: TradeOutcome | null;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
}

// What the prices say, ignoring any result the trader picked: exit == entry is
// break-even (fees alone don't make it a loss), anything else follows net P/L.
export function autoOutcome(
  entryPrice: number | string | null | undefined,
  exitPrice: number | string | null | undefined,
  netPnl: number,
): TradeOutcome {
  if (entryPrice != null && exitPrice != null && Number(entryPrice) === Number(exitPrice)) {
    return 'be';
  }
  if (netPnl > 0) return 'win';
  if (netPnl < 0) return 'loss';
  return 'be';
}

// The API sends `outcome` on every trade; the fallback covers older data.
export function outcomeOf(trade: OutcomeFields): TradeOutcome {
  return (
    trade.outcome || trade.result || autoOutcome(trade.entry_price, trade.exit_price, trade.netPnl)
  );
}

// Break-evens are left out: wins / (wins + losses)
export function winRate(wins: number, losses: number): number {
  const decided = wins + losses;
  return decided > 0 ? Math.round((wins / decided) * 100) : 0;
}

export function countOutcomes(trades: OutcomeFields[]) {
  const counts = { wins: 0, losses: 0, breakEvens: 0 };
  for (const trade of trades) {
    const outcome = outcomeOf(trade);
    if (outcome === 'win') counts.wins += 1;
    else if (outcome === 'loss') counts.losses += 1;
    else counts.breakEvens += 1;
  }
  return { ...counts, winRate: winRate(counts.wins, counts.losses) };
}

// Every emotion on a trade; older trades only have the single `emotion`.
export function emotionsOf(trade: {
  emotions?: string[] | null;
  emotion?: string | null;
}): string[] {
  if (trade.emotions?.length) return trade.emotions;
  return trade.emotion ? [trade.emotion] : [];
}

// +2.8R / -1.0R / 0.0R
export function formatR(r: number | null | undefined): string {
  if (r === null || r === undefined) return '—';
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}${Math.abs(r).toFixed(1)}R`;
}

// R values while a trade is being filled in, same math as the API's rValues:
// result = points made / points risked, planned = target distance / points risked.
// Null when there's no stop, or the stop is on the wrong side of the entry.
export function estimateR(t: {
  direction: string;
  entry_price: number | string;
  exit_price: number | string;
  stop_price: number | string | null;
  target_price: number | string | null;
}): { rMultiple: number; plannedR: number | null; riskPoints: number } | null {
  if (t.stop_price === null || t.stop_price === '') return null;
  const dir = t.direction === 'long' ? 1 : -1;
  const entry = Number(t.entry_price);
  const risk = dir * (entry - Number(t.stop_price));
  if (!(risk > 0)) return null;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const hasTarget = t.target_price !== null && t.target_price !== '';
  return {
    rMultiple: r2((dir * (Number(t.exit_price) - entry)) / risk),
    plannedR: hasTarget ? r2((dir * (Number(t.target_price) - entry)) / risk) : null,
    riskPoints: r2(risk),
  };
}
