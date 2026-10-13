import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ModeBadge, TradeModeService } from '../trade-mode';
import { isRangeKey, rangeDates, RangeKey } from '../reports/report-logic';
import { todayLocal } from '../trade-journal';
import { MIN_QUERY, SearchResult, SearchService, highlight, money, shortDate } from './search';

type Show = 'all' | 'trades' | 'journal';
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '3m', label: 'Last 3 months' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
];

// Everything you've written that mentions a word, and how the trades that mention
// it went next to your overall numbers. The search, filter and range are in the URL.
@Component({
  selector: 'app-search-page',
  imports: [FormsModule, RouterLink, ModeBadge],
  template: `
    <div class="bg-tone-0b0e14 min-h-full xl:h-full flex flex-col text-slate-200">
      <header class="px-6 pt-4 pb-3 shrink-0">
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          Search <app-mode-badge />
        </h1>
        <p class="text-xs text-slate-400">
          Everything you've written in trades and journal days. Tip: Ctrl+K searches from any page.
        </p>
      </header>

      <div class="px-6 pb-4 flex flex-col gap-3 xl:flex-1 xl:min-h-0">
        <label
          class="flex items-center gap-2.5 border rounded-xl bg-tone-0e131c px-3.5 py-2.5 shrink-0 transition-colors"
          [class]="
            typed().trim().length ? 'border-blue-500 ring-2 ring-blue-500/15' : 'border-tone-26354f'
          "
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
            [ngModel]="typed()"
            (ngModelChange)="onType($event)"
            name="q"
            autocomplete="off"
            aria-label="Search your trade notes and journal"
            placeholder="Search your notes, like tired, FOMO, CPI…"
            class="flex-1 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-500"
          />
        </label>

        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
          @for (s of shows; track s.key) {
            <button
              type="button"
              (click)="go({ show: s.key === 'all' ? null : s.key })"
              [attr.aria-pressed]="show() === s.key"
              class="text-xs px-3 py-1 rounded-full border transition-colors"
              [class]="
                show() === s.key
                  ? 'border-blue-500/50 bg-blue-500/12 text-blue-100'
                  : 'border-tone-1f293d text-slate-400 hover:text-slate-200'
              "
            >
              {{ s.label }}
              @if (result(); as r) {
                <span class="font-mono text-slate-500 ml-0.5">{{ countFor(s.key, r) }}</span>
              }
            </button>
          }
          <span class="text-slate-600 mx-1">·</span>
          <select
            [ngModel]="range()"
            (ngModelChange)="go({ range: $event === 'all' ? null : $event })"
            name="range"
            aria-label="Date range"
            class="bg-tone-0e131c border border-tone-1f293d rounded-full px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            @for (r of ranges; track r.key) {
              <option [value]="r.key">{{ r.label }}</option>
            }
          </select>
        </div>

        @if (q().length < minQuery) {
          <p class="text-sm text-slate-500">
            Type at least {{ minQuery }} letters. Try a feeling (<i>tired</i>, <i>FOMO</i>), a
            setup, or a news event.
          </p>
        } @else if (error()) {
          <p class="text-sm text-rose-400" role="alert">{{ error() }}</p>
        } @else if (result(); as r) {
          @let m = r.stats.matched;
          @let o = r.stats.overall;
          @if (m.totalTrades > 0 && show() !== 'journal') {
            <section
              class="rounded-xl border px-4 py-3 shrink-0"
              [class]="
                m.totalPnl < 0
                  ? 'border-rose-500/35 bg-rose-500/[0.06]'
                  : 'border-emerald-500/35 bg-emerald-500/[0.06]'
              "
              aria-label="How these trades went"
            >
              <p class="text-xs text-slate-300 mb-2">
                Trades that mention
                <mark class="bg-amber-400/25 text-amber-200 rounded px-0.5">{{ r.q }}</mark>
              </p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <div class="text-[11px] text-slate-400">Trades</div>
                  <div class="font-mono font-bold text-xl text-white">{{ m.totalTrades }}</div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-400">Win rate</div>
                  <div
                    class="font-mono font-bold text-xl"
                    [class]="m.winRate >= o.winRate ? 'text-emerald-400' : 'text-rose-400'"
                  >
                    {{ m.winRate }}%
                    <span class="font-sans font-normal text-[11px] text-slate-500"
                      >vs {{ o.winRate }}% overall</span
                    >
                  </div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-400">Net P/L</div>
                  <div
                    class="font-mono font-bold text-xl"
                    [class]="m.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                  >
                    {{ money(m.totalPnl) }}
                  </div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-400">Avg per trade</div>
                  <div
                    class="font-mono font-bold text-xl"
                    [class]="avg(m) >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                  >
                    {{ money(avg(m)) }}
                    <span class="font-sans font-normal text-[11px] text-slate-500"
                      >vs {{ money(avg(o)) }}</span
                    >
                  </div>
                </div>
              </div>
            </section>
          }

          <section
            class="bg-tone-121722 border border-tone-1f293d rounded-2xl xl:flex-1 xl:min-h-0 xl:overflow-y-auto quiet-scroll"
            [class.opacity-60]="loading()"
            aria-label="Results"
          >
            @for (hit of rows(); track $index) {
              <a
                [routerLink]="hit.type === 'trade' ? ['/trades', hit.id] : ['/journal']"
                [queryParams]="hit.type === 'journal' ? { date: hit.date } : null"
                class="grid grid-cols-[76px_1fr_110px] gap-3 px-4 py-3 border-t border-tone-1f293d first:border-t-0 items-start hover:bg-white/[0.03]"
              >
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full text-center"
                  [class]="
                    hit.type === 'trade'
                      ? 'bg-blue-500/15 text-blue-200'
                      : 'bg-violet-500/15 text-violet-200'
                  "
                  >{{ hit.type === 'trade' ? 'TRADE' : 'JOURNAL' }}</span
                >
                <span class="min-w-0">
                  <span class="block font-mono text-[10px] tracking-wider uppercase text-slate-500">
                    {{ shortDate(hit.date) }}
                    @if (hit.type === 'trade') {
                      · {{ hit.direction }}
                    }
                    · {{ hit.field }}
                  </span>
                  <span class="block text-[13px] text-slate-300 mt-0.5 break-words">
                    @for (part of parts(hit.snippet); track $index) {
                      <!-- spans, not bare text, so no space appears inside a word -->
                      <span [class]="part.hit ? 'bg-amber-400/25 text-amber-200 rounded-sm' : ''">{{
                        part.text
                      }}</span>
                    }
                  </span>
                </span>
                <span class="text-right text-xs">
                  @if (hit.type === 'trade') {
                    <span
                      class="font-mono font-semibold"
                      [class]="hit.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                      >{{ money(hit.netPnl) }}</span
                    >
                  } @else if (hit.dayNet !== null) {
                    <span class="text-slate-500">day {{ money(hit.dayNet) }}</span>
                  }
                </span>
              </a>
            } @empty {
              @if (!loading()) {
                <p class="px-4 py-10 text-center text-sm text-slate-500">
                  Nothing you've written mentions "{{ r.q }}"{{
                    range() !== 'all' ? ' in this range' : ''
                  }}.
                </p>
              }
            }
            @if (capped(r)) {
              <p class="px-4 py-3 text-xs text-slate-500 border-t border-tone-1f293d">
                Showing the newest 200. Narrow the date range to see older ones.
              </p>
            }
          </section>
        } @else {
          <p class="text-sm text-slate-500">Searching…</p>
        }
      </div>
    </div>
  `,
})
export class SearchPage {
  private search = inject(SearchService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tradeMode = inject(TradeModeService);

  readonly minQuery = MIN_QUERY;
  readonly ranges = RANGES;
  readonly shows: { key: Show; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'trades', label: 'Trades' },
    { key: 'journal', label: 'Journal' },
  ];
  readonly money = money;
  readonly shortDate = shortDate;

  private params = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly q = computed(() => (this.params().get('q') ?? '').trim());
  readonly show = computed<Show>(() => {
    const s = this.params().get('show');
    return s === 'trades' || s === 'journal' ? s : 'all';
  });
  readonly range = computed<RangeKey>(() => {
    const r = this.params().get('range');
    return isRangeKey(r) && r !== 'custom' ? r : 'all';
  });

  typed = signal(this.q());
  result = signal<SearchResult | null>(null);
  loading = signal(false);
  error = signal('');

  readonly rows = computed(() => {
    const r = this.result();
    if (!r) return [];
    if (this.show() === 'trades') return r.trades;
    if (this.show() === 'journal') return r.journal;
    // Newest first, trades and journal days together
    return [...r.trades, ...r.journal].sort((a, b) => b.date.localeCompare(a.date));
  });

  private typing = new Subject<string>();

  constructor() {
    this.typing
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((q) => this.go({ q: q.trim() || null }, true));

    // Search again when the word, range or Live/Backtest changes
    effect((onCleanup) => {
      const q = this.q();
      const mode = this.tradeMode.mode();
      const dates = rangeDates(this.range(), todayLocal());
      if (q.length < MIN_QUERY) {
        this.result.set(null);
        return;
      }
      this.loading.set(true);
      const sub = this.search.search(q, mode, dates).subscribe({
        next: (r) => {
          this.loading.set(false);
          this.error.set('');
          this.result.set(r);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Couldn't search right now. Try again.");
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  onType(text: string) {
    this.typed.set(text);
    this.typing.next(text);
  }

  go(params: Record<string, string | null>, replaceUrl = false) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  countFor(key: Show, r: SearchResult) {
    return key === 'trades'
      ? r.counts.trades
      : key === 'journal'
        ? r.counts.journal
        : r.counts.trades + r.counts.journal;
  }

  capped(r: SearchResult) {
    return r.counts.trades > r.trades.length || r.counts.journal > r.journal.length;
  }

  avg(s: { totalTrades: number; totalPnl: number }) {
    return s.totalTrades ? Math.round((s.totalPnl / s.totalTrades) * 100) / 100 : 0;
  }

  parts(text: string) {
    return highlight(text, this.q());
  }
}
