import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap, catchError, of, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminService,
  FeedbackItem,
  FeedbackPage,
  FeedbackStatus,
  replyLink,
  sentAgo,
} from './admin';
import { Pager } from '../pager/pager';

// One row of filters: everything, by status, or by kind
export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'bug', label: '🐞 Bugs' },
  { key: 'idea', label: '💡 Ideas' },
  { key: 'other', label: '💬 Other' },
  { key: 'working', label: 'Working on' },
  { key: 'done', label: 'Done' },
] as const;
export type FilterKey = (typeof FILTERS)[number]['key'];

export function filterParams(filter: FilterKey): Record<string, string> {
  if (filter === 'new' || filter === 'working' || filter === 'done') return { status: filter };
  if (filter === 'bug' || filter === 'idea' || filter === 'other') return { kind: filter };
  return {};
}

const KIND_TITLE = { bug: 'Bug report', idea: 'Idea', other: 'Message' };

// Admin only: everything users sent with "Send feedback", 8 per page.
// The page, filter and search live in the address bar.
@Component({
  selector: 'app-feedback-inbox',
  imports: [DatePipe, FormsModule, Pager],
  templateUrl: './feedback-inbox.html',
})
export class FeedbackInbox {
  private admin = inject(AdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly filters = FILTERS;
  readonly kindTitle = KIND_TITLE;
  readonly sentAgo = sentAgo;
  readonly replyLink = replyLink;

  data = signal<FeedbackPage | null>(null);
  loading = signal(true);
  errorMessage = signal('');
  filter = signal<FilterKey>('all');
  search = signal('');
  selectedId = signal<number | null>(null);
  note = signal('');
  saving = signal(false);
  noteSaved = signal(false);

  selected = computed(() => {
    const items = this.data()?.items ?? [];
    return items.find((i) => i.id === this.selectedId()) ?? items[0] ?? null;
  });
  firstShown = computed(() => {
    const d = this.data();
    return d && d.total ? (d.page - 1) * d.pageSize + 1 : 0;
  });
  lastShown = computed(() => {
    const d = this.data();
    return d ? (d.page - 1) * d.pageSize + d.items.length : 0;
  });

  private typed = new Subject<string>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.route.queryParamMap
      .pipe(
        tap((q) => {
          const f = q.get('filter');
          this.filter.set(FILTERS.some((x) => x.key === f) ? (f as FilterKey) : 'all');
          this.search.set(q.get('q') ?? '');
          this.loading.set(true);
        }),
        switchMap((q) =>
          this.admin
            .inbox({
              ...filterParams(this.filter()),
              ...(this.search() ? { q: this.search() } : {}),
              page: Number(q.get('page')) || 1,
            })
            .pipe(
              catchError(() => {
                this.errorMessage.set("Couldn't load feedback. Try refreshing.");
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (!page) return;
        this.errorMessage.set('');
        this.data.set(page);
        if (!page.items.some((i) => i.id === this.selectedId())) {
          this.pick(page.items[0] ?? null);
        }
      });

    this.typed
      .pipe(debounceTime(300), takeUntilDestroyed(destroyRef))
      .subscribe((q) => this.go({ q: q.trim() || null, page: null }, true));
  }

  private go(params: Record<string, string | number | null>, replaceUrl = false) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  setFilter(key: FilterKey) {
    this.go({ filter: key === 'all' ? null : key, page: null });
  }

  setPage(page: number) {
    this.go({ page: page === 1 ? null : page });
  }

  onSearch(text: string) {
    this.search.set(text);
    this.typed.next(text);
  }

  count(key: FilterKey) {
    return this.data()?.counts[key] ?? 0;
  }

  pick(item: FeedbackItem | null) {
    this.selectedId.set(item?.id ?? null);
    this.note.set(item?.note ?? '');
    this.noteSaved.set(false);
  }

  setStatus(item: FeedbackItem, status: FeedbackStatus) {
    this.save(item, { status });
  }

  saveNote(item: FeedbackItem) {
    this.save(item, { note: this.note() });
  }

  private save(item: FeedbackItem, change: { status?: FeedbackStatus; note?: string }) {
    this.saving.set(true);
    this.admin.update(item.id, change).subscribe({
      next: (r) => {
        this.saving.set(false);
        const before = item.status;
        this.data.update((d) => {
          if (!d) return d;
          const counts = { ...d.counts };
          if (before !== r.status) {
            counts[before] -= 1;
            counts[r.status] += 1;
          }
          return {
            ...d,
            counts,
            items: d.items.map((i) =>
              i.id === r.id ? { ...i, status: r.status, note: r.note } : i,
            ),
          };
        });
        if (change.note !== undefined) {
          this.note.set(r.note ?? '');
          this.noteSaved.set(true);
        }
        this.admin.refreshNewCount();
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set("Couldn't save that. Try again.");
      },
    });
  }

  // Their page inside the app, when it is one (opens as you, not as them)
  appPage(item: FeedbackItem) {
    return item.page && item.page.startsWith('/') && !item.page.startsWith('//') ? item.page : null;
  }

  openPage(path: string) {
    this.router.navigateByUrl(path);
  }
}
