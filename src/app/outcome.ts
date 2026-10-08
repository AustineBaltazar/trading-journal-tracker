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
