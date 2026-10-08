export const SESSIONS = ['Asian', 'London', 'New York AM', 'New York PM'];
export const EMOTIONS = ['Confident', 'Anxious', 'FOMO', 'Revenge', 'Calm', 'Hesitant'];
export const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];

const pad = (n: number) => String(n).padStart(2, '0');

// Local date as YYYY-MM-DD for <input type="date"> (toISOString would give the UTC day).
export function todayLocal(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// A calendar month; month is 0-based like Date.getMonth().
export interface YearMonth {
  year: number;
  month: number;
}

export function currentMonth(now = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() };
}

// "2026-09" — compared against the start of trade_date strings.
export function monthKey({ year, month }: YearMonth): string {
  return `${String(year).padStart(4, '0')}-${pad(month + 1)}`;
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthsWithTrades(trades: { trade_date: string }[]): Set<string> {
  return new Set(trades.map((t) => t.trade_date.substring(0, 7)));
}

export function tradesInMonth<T extends { trade_date: string }>(trades: T[], ym: YearMonth): T[] {
  const key = monthKey(ym);
  return trades.filter((t) => t.trade_date.startsWith(key));
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Minutes between two HH:MM times; an exit earlier than the entry is treated
// as crossing midnight (23:30 -> 00:15 = 45).
export function holdMinutes(entryTime?: string | null, exitTime?: string | null): number | null {
  if (!entryTime || !exitTime) return null;
  let minutes = toMinutes(exitTime) - toMinutes(entryTime);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

// Duration between two HH:MM times, e.g. "1h 05m".
export function tradeDuration(entryTime?: string | null, exitTime?: string | null): string | null {
  const minutes = holdMinutes(entryTime, exitTime);
  if (minutes === null) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}
