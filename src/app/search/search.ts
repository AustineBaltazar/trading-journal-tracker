import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { TradeMode } from '../trade-mode';
import { DateRange } from '../reports/report-logic';

export interface TradeHit {
  type: 'trade';
  id: number;
  date: string;
  time: string | null;
  direction: 'long' | 'short';
  netPnl: number;
  outcome: 'win' | 'loss' | 'be';
  field: string;
  snippet: string;
}

export interface JournalHit {
  type: 'journal';
  date: string;
  field: string;
  snippet: string;
  dayNet: number | null;
}

export interface Summary {
  totalTrades: number;
  totalPnl: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
}

export interface SearchResult {
  q: string;
  trades: TradeHit[];
  journal: JournalHit[];
  counts: { trades: number; journal: number };
  stats: { matched: Summary; overall: Summary };
}

export const MIN_QUERY = 2;

@Injectable({ providedIn: 'root' })
export class SearchService {
  private http = inject(HttpClient);

  search(q: string, mode: TradeMode, range: DateRange = { from: null, to: null }) {
    const params: Record<string, string> = { q, mode };
    if (range.from) params['from'] = range.from;
    if (range.to) params['to'] = range.to;
    return this.http.get<SearchResult>(`${environment.apiUrl}/search`, { params });
  }
}

// The text split around every match, so the page can mark the searched word
export function highlight(text: string, q: string): { text: string; hit: boolean }[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  const lower = text.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, at)) {
    if (i > at) parts.push({ text: text.slice(at, i), hit: false });
    parts.push({ text: text.slice(i, i + needle.length), hit: true });
    at = i + needle.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Fri, Sep 19"
export function shortDate(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[day]}, ${MONTHS[m - 1]} ${d}`;
}

// "+$96.50" / "−$288.96"
export function money(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}$${abs}`;
}
