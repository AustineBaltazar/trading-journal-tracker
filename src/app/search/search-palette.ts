import { Component, ElementRef, computed, inject, signal, viewChild, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Subject, debounceTime, switchMap, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TradeModeService } from '../trade-mode';
import {
  JournalHit,
  MIN_QUERY,
  SearchResult,
  SearchService,
  TradeHit,
  highlight,
  money,
  shortDate,
} from './search';

const PER_GROUP = 5;

// Ctrl+K (or the sidebar's "Search notes") from any page: results as you type,
// arrow keys to move, Enter to open. "See all" goes to the Search page.
@Component({
  selector: 'app-search-palette',
  imports: [FormsModule, NgTemplateOutlet],
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  template: `
    <button
      type="button"
      (click)="show()"
      class="w-full flex items-center gap-2 border border-tone-26354f bg-tone-0e131c hover:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-500 transition-colors"
    >
      <svg
        class="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      Search notes
      <kbd
        class="ml-auto font-mono text-[10px] border border-tone-26354f rounded px-1.5 text-slate-500"
        >Ctrl K</kbd
      >
    </button>

    @if (open()) {
      <div
        class="fixed inset-0 z-50 bg-black/60 flex justify-center items-start pt-[12vh] px-4"
        (click)="close()"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search notes"
          class="w-full max-w-2xl bg-tone-121722 border border-tone-2b3a55 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
          (click)="$event.stopPropagation()"
          (keydown)="onKey($event)"
        >
          <div class="p-3">
            <label
              class="flex items-center gap-2.5 border border-blue-500 rounded-xl bg-tone-0e131c px-3.5 py-2.5 ring-2 ring-blue-500/15"
            >
              <svg
                class="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                #box
                [ngModel]="query()"
                (ngModelChange)="onType($event)"
                name="q"
                autocomplete="off"
                aria-label="Search your trade notes and journal"
                placeholder="Search your trade notes and journal…"
                class="flex-1 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-500"
              />
              <kbd
                class="font-mono text-[10px] border border-tone-26354f rounded px-1.5 text-slate-500"
                >Esc</kbd
              >
            </label>
          </div>

          <div class="max-h-[55vh] overflow-y-auto quiet-scroll" role="listbox">
            @if (query().trim().length < minQuery) {
              <p class="px-4 pb-5 text-sm text-slate-500">
                Type a word, like <i>tired</i>, <i>FOMO</i> or a setup name.
              </p>
            } @else if (loading() && !result()) {
              <p class="px-4 pb-5 text-sm text-slate-500">Searching…</p>
            } @else if (result(); as r) {
              @if (r.counts.trades + r.counts.journal === 0) {
                <p class="px-4 pb-5 text-sm text-slate-500">
                  Nothing you've written mentions "{{ r.q }}".
                </p>
              }
              @if (r.trades.length) {
                <p
                  class="px-4 pt-1 pb-1 text-[10.5px] uppercase tracking-wider font-semibold text-slate-500"
                >
                  Trades · {{ r.counts.trades }}
                </p>
                @for (hit of r.trades.slice(0, perGroup); track hit.id; let i = $index) {
                  <button
                    type="button"
                    role="option"
                    [attr.aria-selected]="active() === i"
                    (click)="openHit(hit)"
                    (mouseenter)="active.set(i)"
                    class="w-full text-left px-4 py-2"
                    [class]="active() === i ? 'bg-blue-500/10 shadow-[inset_3px_0_0_#3b82f6]' : ''"
                  >
                    <span class="block text-[11px] text-slate-500">
                      {{ shortDate(hit.date) }} ·
                      {{ hit.direction === 'long' ? 'Long' : 'Short' }} ·
                      <span
                        class="font-mono"
                        [class]="hit.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                        >{{ money(hit.netPnl) }}</span
                      >
                      · {{ hit.field }}
                    </span>
                    <ng-container
                      *ngTemplateOutlet="text; context: { $implicit: hit.snippet }"
                    ></ng-container>
                  </button>
                }
              }
              @if (r.journal.length) {
                <p
                  class="px-4 pt-2 pb-1 text-[10.5px] uppercase tracking-wider font-semibold text-slate-500"
                >
                  Journal · {{ r.counts.journal }}
                </p>
                @for (hit of r.journal.slice(0, perGroup); track $index; let i = $index) {
                  @let n = tradeCount() + i;
                  <button
                    type="button"
                    role="option"
                    [attr.aria-selected]="active() === n"
                    (click)="openHit(hit)"
                    (mouseenter)="active.set(n)"
                    class="w-full text-left px-4 py-2"
                    [class]="active() === n ? 'bg-blue-500/10 shadow-[inset_3px_0_0_#3b82f6]' : ''"
                  >
                    <span class="block text-[11px] text-slate-500"
                      >{{ shortDate(hit.date) }} · {{ hit.field }}</span
                    >
                    <ng-container
                      *ngTemplateOutlet="text; context: { $implicit: hit.snippet }"
                    ></ng-container>
                  </button>
                }
              }
            }
          </div>

          <div
            class="flex justify-between items-center px-4 py-2.5 border-t border-tone-1f293d text-[11.5px] text-slate-500"
          >
            <span>↑↓ to move · ↵ to open · Esc to close</span>
            @if (result(); as r) {
              @if (r.counts.trades + r.counts.journal > 0) {
                <button type="button" (click)="seeAll()" class="text-blue-300 hover:text-blue-200">
                  See all {{ r.counts.trades + r.counts.journal }} results and their stats ›
                </button>
              }
            }
          </div>
        </div>
      </div>
    }

    <ng-template #text let-snippet>
      <span class="block text-[13px] text-slate-300 truncate">
        @for (part of parts(snippet); track $index) {
          <!-- spans, not bare text, so no space appears inside a word -->
          <span [class]="part.hit ? 'bg-amber-400/25 text-amber-200 rounded-sm' : ''">{{
            part.text
          }}</span>
        }
      </span>
    </ng-template>
  `,
})
export class SearchPalette {
  private search = inject(SearchService);
  private router = inject(Router);
  private tradeMode = inject(TradeModeService);
  private box = viewChild<ElementRef<HTMLInputElement>>('box');

  readonly minQuery = MIN_QUERY;
  readonly perGroup = PER_GROUP;
  readonly shortDate = shortDate;
  readonly money = money;

  open = signal(false);
  query = signal('');
  result = signal<SearchResult | null>(null);
  loading = signal(false);
  active = signal(0);

  readonly tradeCount = computed(() => Math.min(PER_GROUP, this.result()?.trades.length ?? 0));
  private readonly hits = computed<(TradeHit | JournalHit)[]>(() => {
    const r = this.result();
    return r ? [...r.trades.slice(0, PER_GROUP), ...r.journal.slice(0, PER_GROUP)] : [];
  });

  private typed = new Subject<string>();

  constructor() {
    this.typed
      .pipe(
        debounceTime(200),
        switchMap((q) => {
          if (q.trim().length < MIN_QUERY) return of(null);
          this.loading.set(true);
          return this.search
            .search(q.trim(), this.tradeMode.mode())
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.loading.set(false);
        this.result.set(r);
        this.active.set(0);
      });
    // Focus the box once the popup is on screen
    effect(() => {
      if (this.open()) queueMicrotask(() => this.box()?.nativeElement.focus());
    });
  }

  parts(text: string) {
    return highlight(text, this.query());
  }

  show() {
    this.open.set(true);
  }

  close() {
    this.open.set(false);
  }

  onType(q: string) {
    this.query.set(q);
    if (q.trim().length < MIN_QUERY) this.result.set(null);
    this.typed.next(q);
  }

  // Ctrl+K / Cmd+K opens it from anywhere
  onGlobalKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.open.update((o) => !o);
    }
  }

  onKey(e: KeyboardEvent) {
    const count = this.hits().length;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'ArrowDown' && count) {
      e.preventDefault();
      this.active.update((i) => (i + 1) % count);
    } else if (e.key === 'ArrowUp' && count) {
      e.preventDefault();
      this.active.update((i) => (i - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = this.hits()[this.active()];
      if (hit) this.openHit(hit);
      else if (this.query().trim().length >= MIN_QUERY) this.seeAll();
    }
  }

  openHit(hit: TradeHit | JournalHit) {
    this.close();
    if (hit.type === 'trade') this.router.navigate(['/trades', hit.id]);
    else this.router.navigate(['/journal'], { queryParams: { date: hit.date } });
  }

  seeAll() {
    this.close();
    this.router.navigate(['/search'], { queryParams: { q: this.query().trim() } });
  }
}
