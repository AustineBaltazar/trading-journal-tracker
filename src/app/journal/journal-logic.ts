import { SESSIONS } from '../trade-journal';

export const BIASES = ['bullish', 'neutral', 'bearish'] as const;
export const FOLLOWED = ['yes', 'partly', 'no'] as const;
export const MOODS = ['Focused', 'Calm', 'Bored', 'Tired', 'Frustrated'] as const;
export const DAY_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;

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

// Compact P/L for a mini-calendar cell: +415, −32, +1.2k
export function shortPnl(pnl: number): string {
  const sign = pnl > 0 ? '+' : pnl < 0 ? '−' : '';
  const abs = Math.abs(pnl);
  return sign + (abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${Math.round(abs)}`);
}

// How many days in the month have a plan / a review written
export function journalCounts(entries: EntrySummary[], monthKey: string) {
  const inMonth = entries.filter((e) => e.date.startsWith(monthKey));
  return {
    plans: inMonth.filter((e) => e.hasPlan).length,
    reviews: inMonth.filter((e) => e.hasReview).length,
  };
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

export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
