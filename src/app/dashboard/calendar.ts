import { outcomeOf } from '../outcome';
import { monthKey, tradesInMonth, YearMonth } from '../trade-journal';

export interface CalendarDay {
  day: number;
  date: string;
  pnl: number;
  wins: number;
  losses: number;
  breakEvens: number;
  count: number;
  ruleBroken: boolean;
  // 0..1: this day's |P/L| relative to the biggest day of the month
  strength: number;
  isToday: boolean;
}

export interface CalendarWeek {
  days: (CalendarDay | null)[]; // Mon..Fri; null = outside the month
  pnl: number;
  count: number;
}

export interface CalendarMonth {
  weeks: CalendarWeek[];
  summary: {
    net: number;
    greenDays: number;
    redDays: number;
    best: CalendarDay | null;
    worst: CalendarDay | null;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildCalendarMonth(trades: any[], ym: YearMonth, today: string): CalendarMonth {
  const monthTrades = tradesInMonth(trades, ym);

  const byDate = new Map<string, CalendarDay>();
  for (const trade of monthTrades) {
    const date = trade.trade_date.substring(0, 10);
    const day = byDate.get(date) ?? {
      day: Number(date.substring(8, 10)),
      date,
      pnl: 0,
      wins: 0,
      losses: 0,
      breakEvens: 0,
      count: 0,
      ruleBroken: false,
      strength: 0,
      isToday: false,
    };
    day.pnl += trade.netPnl;
    day.count += 1;
    const outcome = outcomeOf(trade);
    if (outcome === 'win') day.wins += 1;
    else if (outcome === 'loss') day.losses += 1;
    else day.breakEvens += 1;
    if (trade.rulesFollowed === false) day.ruleBroken = true;
    byDate.set(date, day);
  }
  for (const day of byDate.values()) day.pnl = round2(day.pnl);
  const maxAbs = Math.max(0, ...[...byDate.values()].map((d) => Math.abs(d.pnl)));

  // One row per Monday-Friday week. A new row starts on each Monday (or on the
  // first weekday of the month), so months starting on a weekend line up too.
  const prefix = monthKey(ym);
  const daysInMonth = new Date(Date.UTC(ym.year, ym.month + 1, 0)).getUTCDate();
  const weeks: CalendarWeek[] = [];
  let week: CalendarWeek | null = null;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(0);
    date.setUTCFullYear(ym.year, ym.month, d);
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (!week || weekday === 1) {
      week = { days: [null, null, null, null, null], pnl: 0, count: 0 };
      weeks.push(week);
    }
    const key = `${prefix}-${String(d).padStart(2, '0')}`;
    const traded = byDate.get(key);
    const cell: CalendarDay = traded
      ? { ...traded, strength: maxAbs > 0 ? Math.abs(traded.pnl) / maxAbs : 0 }
      : {
          day: d,
          date: key,
          pnl: 0,
          wins: 0,
          losses: 0,
          breakEvens: 0,
          count: 0,
          ruleBroken: false,
          strength: 0,
          isToday: false,
        };
    cell.isToday = key === today;
    week.days[weekday - 1] = cell;
    week.pnl += cell.pnl;
    week.count += cell.count;
  }
  for (const w of weeks) w.pnl = round2(w.pnl);

  const traded = [...byDate.values()];
  const best = traded.reduce<CalendarDay | null>(
    (b, d) => (d.pnl > 0 && (!b || d.pnl > b.pnl) ? d : b),
    null,
  );
  const worst = traded.reduce<CalendarDay | null>(
    (w, d) => (d.pnl < 0 && (!w || d.pnl < w.pnl) ? d : w),
    null,
  );

  return {
    weeks,
    summary: {
      net: round2(monthTrades.reduce((sum, t) => sum + t.netPnl, 0)),
      greenDays: traded.filter((d) => d.pnl > 0).length,
      redDays: traded.filter((d) => d.pnl < 0).length,
      best,
      worst,
    },
  };
}

// Inline background/border for a traded day: stronger color for bigger days.
// A day of only break-evens is gray, whatever the fees did to its P/L.
export function dayStyle(day: CalendarDay): Record<string, string> | null {
  if (day.count === 0) return null;
  if (day.wins === 0 && day.losses === 0) {
    return {
      'background-color': 'rgba(148,163,184,0.12)',
      'border-color': 'rgba(148,163,184,0.35)',
    };
  }
  if (day.pnl === 0) return null;
  const rgb = day.pnl > 0 ? '16,185,129' : '244,63,94';
  const alpha = 0.1 + 0.45 * day.strength;
  return {
    'background-color': `rgba(${rgb},${alpha.toFixed(2)})`,
    'border-color': `rgba(${rgb},${(alpha + 0.15).toFixed(2)})`,
  };
}
