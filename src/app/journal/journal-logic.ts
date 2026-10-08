import { SESSIONS } from '../trade-journal';

export const BIASES = ['bullish', 'neutral', 'bearish'] as const;
export const FOLLOWED = ['yes', 'partly', 'no'] as const;
export const MOODS = ['Focused', 'Calm', 'Bored', 'Tired', 'Frustrated'] as const;
export const DAY_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_SECTION = 6;

export interface KeyLevel {
  price: number;
  label: string;
}

export interface JournalEntry {
  bias: string | null;
  bias_reason: string | null;
  key_levels: KeyLevel[];
  plan: string | null;
  news: string | null;
  focus: string | null;
  followed_plan: string | null;
  mood: string | null;
  day_grade: string | null;
  went_well: string | null;
  to_fix: string | null;
  lesson: string | null;
}

export const EMPTY_ENTRY: JournalEntry = {
  bias: null,
  bias_reason: null,
  key_levels: [],
  plan: null,
  news: null,
  focus: null,
  followed_plan: null,
  mood: null,
  day_grade: null,
  went_well: null,
  to_fix: null,
  lesson: null,
};

export interface JournalImage {
  id: number;
  section: 'pre' | 'post';
  caption: string | null;
  url: string;
  createdAt: string;
}

export interface EntrySummary {
  date: string;
  hasPlan: boolean;
  hasReview: boolean;
  imageCount: number;
}

export interface DayRow {
  date: string;
  weekday: string;
  day: number;
  tradeCount: number;
  pnl: number;
  hasPlan: boolean;
  hasReview: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Every day in the month that has trades or a journal entry, newest first
export function buildDayList(
  monthKey: string,
  entries: EntrySummary[],
  trades: { trade_date: string; netPnl: number }[],
): DayRow[] {
  const days = new Map<string, DayRow>();
  const row = (date: string): DayRow => {
    let r = days.get(date);
    if (!r) {
      const d = new Date(`${date}T00:00:00Z`);
      r = {
        date,
        weekday: WEEKDAYS[d.getUTCDay()],
        day: d.getUTCDate(),
        tradeCount: 0,
        pnl: 0,
        hasPlan: false,
        hasReview: false,
      };
      days.set(date, r);
    }
    return r;
  };
  for (const t of trades) {
    const date = t.trade_date.substring(0, 10);
    if (!date.startsWith(monthKey)) continue;
    const r = row(date);
    r.tradeCount += 1;
    r.pnl = Math.round((r.pnl + t.netPnl) * 100) / 100;
  }
  for (const e of entries) {
    if (!e.date.startsWith(monthKey)) continue;
    const r = row(e.date);
    r.hasPlan = e.hasPlan;
    r.hasReview = e.hasReview;
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// If today's focus names a session, flags trades taken in a different one
export function focusSessionWarning(
  focus: string | null,
  trades: { session?: string | null }[],
): string | null {
  if (!focus) return null;
  const text = focus.toLowerCase();
  const named = SESSIONS.filter((s) => text.includes(s.toLowerCase()));
  if (named.length === 0) return null;
  const outside = [
    ...new Set(trades.map((t) => t.session).filter((s): s is string => !!s && !named.includes(s))),
  ];
  if (outside.length === 0) return null;
  const sessions = outside.join(' and ');
  return `Your focus was "${focus.trim().replace(/[.!]+$/, '')}". ${outside.length === 1 ? 'A trade was' : 'Trades were'} taken in the ${sessions} session${outside.length === 1 ? '' : 's'}.`;
}

// Checked before asking the server for an upload link
export function imageFileError(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Images must be PNG, JPG or WebP.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.';
  return null;
}

export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
