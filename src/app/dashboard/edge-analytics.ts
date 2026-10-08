import { EMOTIONS, GRADES, SESSIONS } from '../trade-journal';

// Groups with fewer trades than this are faded and never picked as a highlight.
export const MIN_SAMPLE = 3;

export interface GroupStats {
  key: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  net: number;
}

export interface EdgeAnalytics {
  taggedCount: number;
  untaggedCount: number;
  sessions: GroupStats[];
  emotions: GroupStats[];
  grades: GroupStats[];
  hours: GroupStats[];
  bestSession: GroupStats | null;
  bestHour: GroupStats | null;
  costliestEmotion: GroupStats | null;
  aGradeShare: number | null;
  mostTakenGrade: string | null;
  avgHoldWinners: number | null;
  avgHoldLosers: number | null;
}

function isTagged(trade: any): boolean {
  return Boolean(trade.session || trade.emotion || trade.grade || trade.entry_time);
}

function holdMinutes(trade: any): number | null {
  if (!trade.entry_time || !trade.exit_time) return null;
  const [eh, em] = trade.entry_time.split(':').map(Number);
  const [xh, xm] = trade.exit_time.split(':').map(Number);
  let minutes = xh * 60 + xm - (eh * 60 + em);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

// Stats per key, in the given order; keys with no trades are left out.
// Win rate matches /trades/summary: wins / all trades in the group.
function groupBy(
  trades: any[],
  keyOf: (trade: any) => string | null,
  order: string[],
): GroupStats[] {
  const groups = new Map<string, GroupStats>();
  for (const trade of trades) {
    const key = keyOf(trade);
    if (!key) continue;
    const stats = groups.get(key) ?? { key, total: 0, wins: 0, losses: 0, winRate: 0, net: 0 };
    stats.total += 1;
    stats.net += trade.netPnl;
    if (trade.netPnl > 0) stats.wins += 1;
    else if (trade.netPnl < 0) stats.losses += 1;
    groups.set(key, stats);
  }
  return order
    .filter((key) => groups.has(key))
    .map((key) => {
      const stats = groups.get(key)!;
      return {
        ...stats,
        net: Math.round(stats.net * 100) / 100,
        winRate: Math.round((stats.wins / stats.total) * 100),
      };
    });
}

function pick(
  groups: GroupStats[],
  better: (a: GroupStats, b: GroupStats) => boolean,
  minTrades = MIN_SAMPLE,
) {
  let best: GroupStats | null = null;
  for (const group of groups) {
    if (group.total < minTrades) continue;
    if (!best || better(group, best)) best = group;
  }
  return best;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function buildEdgeAnalytics(trades: any[]): EdgeAnalytics {
  const tagged = trades.filter(isTagged);

  const hourOf = (trade: any) => (trade.entry_time ? trade.entry_time.substring(0, 2) : null);
  const hourOrder = [...new Set(tagged.map(hourOf).filter((h): h is string => !!h))].sort();

  const sessions = groupBy(tagged, (t) => t.session, SESSIONS);
  const emotions = groupBy(tagged, (t) => t.emotion, EMOTIONS);
  const grades = groupBy(tagged, (t) => t.grade, GRADES);
  const hours = groupBy(tagged, hourOf, hourOrder);

  const gradedCount = grades.reduce((sum, g) => sum + g.total, 0);
  const aGrades = grades
    .filter((g) => g.key === 'A+' || g.key === 'A')
    .reduce((sum, g) => sum + g.total, 0);
  const mostTaken = grades.reduce<GroupStats | null>(
    (m, g) => (!m || g.total > m.total ? g : m),
    null,
  );

  // Money lost counts at any sample size, unlike win-rate highlights
  const costliest = pick(emotions, (a, b) => a.net < b.net, 1);

  const winnerHolds: number[] = [];
  const loserHolds: number[] = [];
  for (const trade of tagged) {
    const minutes = holdMinutes(trade);
    if (minutes === null) continue;
    if (trade.netPnl > 0) winnerHolds.push(minutes);
    else if (trade.netPnl < 0) loserHolds.push(minutes);
  }

  return {
    taggedCount: tagged.length,
    untaggedCount: trades.length - tagged.length,
    sessions,
    emotions,
    grades,
    hours,
    bestSession: pick(sessions, (a, b) => a.net > b.net),
    bestHour: pick(
      hours,
      (a, b) => a.winRate > b.winRate || (a.winRate === b.winRate && a.net > b.net),
    ),
    costliestEmotion: costliest && costliest.net < 0 ? costliest : null,
    aGradeShare: gradedCount > 0 ? Math.round((aGrades / gradedCount) * 100) : null,
    mostTakenGrade: mostTaken?.key ?? null,
    avgHoldWinners: average(winnerHolds),
    avgHoldLosers: average(loserHolds),
  };
}

// Color tier for a win rate, shared by the bars and the entry-hour tiles.
export function winRateTier(winRate: number): 'high' | 'mid' | 'low' {
  if (winRate >= 65) return 'high';
  if (winRate >= 45) return 'mid';
  return 'low';
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
