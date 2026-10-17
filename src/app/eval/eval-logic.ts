import { outcomeOf, OutcomeFields } from '../outcome';

export type DrawdownType = 'eod_trailing' | 'trailing' | 'static';

// The firm's rules. null = the firm doesn't have that rule.
export interface EvalRules {
  name: string;
  accountSize: number;
  profitTarget: number | null;
  maxDrawdown: number | null;
  drawdownType: DrawdownType;
  dailyLossLimit: number | null;
  minDays: number | null;
  consistencyPct: number | null;
}

export interface EvalAttempt extends EvalRules {
  id: number;
  startedOn: string;
  endedOn: string | null;
  result: 'passed' | 'failed' | null;
  failReason: string | null;
}

// Starting points from Tradeify's help center (Oct 2026). Firms change rules,
// so every number stays editable.
export const PRESETS: { key: string; label: string; rules: EvalRules }[] = [
  {
    key: 'tradeify-growth-25k',
    label: 'Tradeify Growth 25K',
    rules: {
      name: 'Tradeify Growth 25K',
      accountSize: 25000,
      profitTarget: 1500,
      maxDrawdown: 1000,
      drawdownType: 'eod_trailing',
      dailyLossLimit: 600,
      minDays: null,
      consistencyPct: null,
    },
  },
  {
    key: 'tradeify-select-25k',
    label: 'Tradeify Select 25K',
    rules: {
      name: 'Tradeify Select 25K',
      accountSize: 25000,
      profitTarget: 1500,
      maxDrawdown: 1000,
      drawdownType: 'eod_trailing',
      dailyLossLimit: null,
      minDays: 3,
      consistencyPct: 40,
    },
  },
  {
    key: 'tradeify-growth-50k',
    label: 'Tradeify Growth 50K',
    rules: {
      name: 'Tradeify Growth 50K',
      accountSize: 50000,
      profitTarget: 3000,
      maxDrawdown: 2000,
      drawdownType: 'eod_trailing',
      dailyLossLimit: 1250,
      minDays: null,
      consistencyPct: null,
    },
  },
  {
    key: 'tradeify-select-50k',
    label: 'Tradeify Select 50K',
    rules: {
      name: 'Tradeify Select 50K',
      accountSize: 50000,
      profitTarget: 3000,
      maxDrawdown: 2000,
      drawdownType: 'eod_trailing',
      dailyLossLimit: null,
      minDays: 3,
      consistencyPct: 40,
    },
  },
];

export type EvalTrade = OutcomeFields & {
  id: number;
  trade_date: string;
  entry_time?: string | null;
};

export interface EvalDay {
  date: string;
  net: number;
  trades: number;
  hitDailyLimit: boolean;
  today: boolean;
}

export type EvalStatus = 'on-track' | 'close' | 'target-reached' | 'almost' | 'breached';

export interface EvalProgress {
  trades: EvalTrade[];
  profit: number;
  balance: number;
  highBalance: number;
  floor: number | null; // fail below this balance
  roomLeft: number | null; // balance − floor
  today: { net: number; trades: number; left: number | null; canLose: number | null };
  avgLoss: number | null;
  stopsLeft: number | null; // full average losses that fit in what you can still lose today
  days: EvalDay[];
  daysTraded: number;
  daysNeeded: number; // more trading days still required
  targetLeft: number | null;
  targetPct: number | null;
  bestDay: number;
  consistency: number | null; // best day as % of profit
  consistencyOk: boolean;
  status: EvalStatus;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function attemptTrades<T extends EvalTrade>(trades: T[], attempt: EvalAttempt): T[] {
  return trades
    .filter((t) => {
      const d = t.trade_date.slice(0, 10);
      return d >= attempt.startedOn && (!attempt.endedOn || d <= attempt.endedOn);
    })
    .sort(
      (a, b) =>
        a.trade_date.localeCompare(b.trade_date) ||
        (a.entry_time ?? '').localeCompare(b.entry_time ?? '') ||
        a.id - b.id,
    );
}

// Where an attempt stands, from the trades logged in it
export function evalProgress(
  attempt: EvalAttempt,
  allTrades: EvalTrade[],
  today: string,
): EvalProgress {
  const trades = attemptTrades(allTrades, attempt);
  const size = attempt.accountSize;

  // Day by day
  const byDay = new Map<string, EvalTrade[]>();
  for (const t of trades) {
    const d = t.trade_date.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), t]);
  }
  const limit = attempt.dailyLossLimit;
  const days: EvalDay[] = [...byDay.entries()].map(([date, list]) => {
    const net = round(list.reduce((s, t) => s + t.netPnl, 0));
    return {
      date,
      net,
      trades: list.length,
      hitDailyLimit: limit !== null && net <= -limit,
      today: date === today,
    };
  });

  // Balance, its high point, and the drawdown floor
  const profit = round(trades.reduce((s, t) => s + t.netPnl, 0));
  const balance = round(size + profit);
  let high = size;
  if (attempt.drawdownType === 'trailing') {
    let running = size;
    for (const t of trades) high = Math.max(high, (running += t.netPnl));
  } else if (attempt.drawdownType === 'eod_trailing') {
    // the high only moves at the end of a day, so today doesn't count yet
    let running = size;
    for (const d of days) {
      running += d.net;
      if (!d.today) high = Math.max(high, running);
    }
  }
  high = round(high);
  const dd = attempt.maxDrawdown;
  const floor =
    dd === null ? null : round(attempt.drawdownType === 'static' ? size - dd : high - dd);
  const roomLeft = floor === null ? null : round(balance - floor);

  // Today
  const todayDay = days.find((d) => d.today);
  const todayNet = todayDay?.net ?? 0;
  const dailyLeft = limit === null ? null : round(Math.max(0, limit + todayNet));
  const canLose =
    dailyLeft === null && roomLeft === null
      ? null
      : round(Math.max(0, Math.min(dailyLeft ?? Infinity, roomLeft ?? Infinity)));
  const losses = trades.filter((t) => outcomeOf(t) === 'loss').map((t) => -t.netPnl);
  const avgLoss = losses.length ? round(losses.reduce((s, x) => s + x, 0) / losses.length) : null;
  const stopsLeft = canLose !== null && avgLoss ? Math.floor(canLose / avgLoss) : null;

  // Road to pass
  const target = attempt.profitTarget;
  const targetLeft = target === null ? null : round(Math.max(0, target - profit));
  const targetPct =
    target === null ? null : Math.max(0, Math.min(100, Math.round((profit / target) * 100)));
  const daysTraded = days.length;
  const daysNeeded = attempt.minDays === null ? 0 : Math.max(0, attempt.minDays - daysTraded);
  const bestDay = days.reduce((m, d) => Math.max(m, d.net), 0);
  const consistency = profit > 0 && bestDay > 0 ? Math.round((bestDay / profit) * 100) : null;
  const consistencyOk =
    attempt.consistencyPct === null ||
    consistency === null ||
    consistency <= attempt.consistencyPct;

  let status: EvalStatus = 'on-track';
  if (roomLeft !== null && roomLeft <= 0) status = 'breached';
  else if (target !== null && profit >= target)
    status = daysNeeded === 0 && consistencyOk ? 'target-reached' : 'almost';
  else if (
    (roomLeft !== null && dd !== null && roomLeft < dd * 0.25) ||
    (dailyLeft !== null && limit !== null && dailyLeft < limit * 0.25)
  )
    status = 'close';

  return {
    trades,
    profit,
    balance,
    highBalance: high,
    floor,
    roomLeft,
    today: { net: todayNet, trades: todayDay?.trades ?? 0, left: dailyLeft, canLose },
    avgLoss,
    stopsLeft,
    days,
    daysTraded,
    daysNeeded,
    targetLeft,
    targetPct,
    bestDay,
    consistency,
    consistencyOk,
    status,
  };
}

export const STATUS_TEXT: Record<EvalStatus, string> = {
  'on-track': 'On track',
  close: 'Close to a limit',
  'target-reached': 'Target reached',
  almost: 'Target hit, rules left',
  breached: 'Drawdown breached',
};
