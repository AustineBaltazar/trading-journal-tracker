import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth';
import { BRAND } from '../brand';

export type FeedbackStatus = 'new' | 'working' | 'done';
export type FeedbackKind = 'bug' | 'idea' | 'other';

export interface FeedbackItem {
  id: number;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  device: string | null;
  status: FeedbackStatus;
  note: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    demo: boolean;
    joinedAt: string;
    trades: number;
  } | null;
}

export interface FeedbackPage {
  items: FeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  counts: Record<'all' | FeedbackStatus | FeedbackKind | 'thisWeek', number>;
  users: { total: number; newThisWeek: number };
}

// The admin-only feedback inbox, and the "new" number for the menu badge
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/admin/feedback`;
  readonly newCount = signal(0);

  refreshNewCount() {
    this.http.get<{ new: number }>(`${this.api}/new-count`).subscribe({
      next: (r) => this.newCount.set(r.new),
      error: () => {},
    });
  }

  inbox(params: Record<string, string | number>) {
    return this.http.get<FeedbackPage>(this.api, { params });
  }

  update(id: number, change: { status?: FeedbackStatus; note?: string }) {
    return this.http.patch<{ id: number; status: FeedbackStatus; note: string | null }>(
      `${this.api}/${id}`,
      change,
    );
  }
}

// The server refuses everyone else anyway; this just keeps them off the page
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  return auth
    .ensureUser()
    .pipe(map((ok) => (ok && auth.user()?.admin) || router.createUrlTree(['/dashboard'])));
};

// "12 min ago", "2 hours ago", "Yesterday", "Oct 10"
export function sentAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// An email reply with their message quoted underneath
export function replyLink(item: FeedbackItem) {
  if (!item.user) return null;
  const quoted = item.message
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const subject = `Re: your ${BRAND.name} feedback`;
  const body = `Hi ${item.user.name},\n\n\n\n${quoted}`;
  return `mailto:${item.user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
