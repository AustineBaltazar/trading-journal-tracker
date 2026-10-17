import { Component, effect, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewTrade } from '../new-trade/new-trade';
import { MonthPicker } from '../month-picker/month-picker';
import { ModeBadge, TradeModeService } from '../trade-mode';
import { Mistake } from '../mistakes/mistakes';
import { emotionsOf, formatR, outcomeOf } from '../outcome';
import { environment } from '../../environments/environment';
import { Pager } from '../pager/pager';
import {
  currentMonth,
  EMOTIONS,
  MONTH_NAMES,
  GRADES,
  monthLabel as formatMonth,
  monthsWithTrades,
  SESSIONS,
  tradeDuration,
  tradesInMonth,
  YearMonth,
} from '../trade-journal';
import {
  filterTrades,
  NO_FILTERS,
  Outcome,
  SortDir,
  SortKey,
  sortTrades,
  summarizeTrades,
  TradeFilters,
} from './trade-filters';

const BAD_EMOTIONS = new Set(['FOMO', 'Revenge']);
const LOW_GRADES = new Set(['C+', 'C', 'D', 'F']);
export const PAGE_SIZES = [10, 25, 50];
const PAGE_SIZE_KEY = 'tradesPageSize';

function savedPageSize() {
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(n) ? n : 10;
  } catch {
    return 10;
  }
}

@Component({
  imports: [SlicePipe, DecimalPipe, FormsModule, NewTrade, MonthPicker, ModeBadge, Pager],
  selector: 'app-trades-list',
  styleUrl: './trades-list.css',
  templateUrl: './trades-list.html',
})
export class TradesList {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly tradeMode = inject(TradeModeService);

  trades = signal<any[]>([]);
  showNewTradeModal = signal(false);

  viewedMonth = signal<YearMonth>(currentMonth());
  monthLabel = computed(() => formatMonth(this.viewedMonth()));
  tradeMonths = computed(() => monthsWithTrades(this.trades()));

  filters = signal<TradeFilters>({ ...NO_FILTERS });
  sortKey = signal<SortKey>('date');
  sortDir = signal<SortDir>('desc');

  mistakes = signal<Mistake[]>([]);

  readonly sessions = SESSIONS;
  readonly emotions = EMOTIONS;
  readonly grades = GRADES;

  monthTrades = computed(() => tradesInMonth(this.trades(), this.viewedMonth()));

  filteredTrades = computed(() =>
    sortTrades(filterTrades(this.monthTrades(), this.filters()), this.sortKey(), this.sortDir()),
  );

  // Summary bar follows the filters (every page, not just this one)
  summary = computed(() => summarizeTrades(this.filteredTrades()));

  // One page of the filtered list. The page number is kept in the address bar,
  // so coming back from a trade returns to the same page.
  readonly pageSizes = PAGE_SIZES;
  pageSize = signal(savedPageSize());
  page = signal(Math.max(1, Number(this.route.snapshot.queryParamMap.get('page')) || 1));
  pages = computed(() => Math.max(1, Math.ceil(this.filteredTrades().length / this.pageSize())));
  currentPage = computed(() => Math.min(this.page(), this.pages()));
  pageTrades = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredTrades().slice(start, start + this.pageSize());
  });
  firstShown = computed(() =>
    this.filteredTrades().length ? (this.currentPage() - 1) * this.pageSize() + 1 : 0,
  );
  lastShown = computed(() => (this.currentPage() - 1) * this.pageSize() + this.pageTrades().length);

  activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.search.trim(),
      f.session,
      f.emotion,
      f.grade,
      f.rulesBrokenOnly,
      f.mistake,
      f.outcome !== 'all',
    ].filter(Boolean).length;
  });

  // Loads on start and again whenever the live/backtest switch changes
  constructor() {
    effect(() => this.loadTrades(this.tradeMode.mode()));
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`)
      .subscribe((response) => this.mistakes.set(response.mistakes));
  }

  loadTrades(mode = this.tradeMode.mode()) {
    this.http
      .get<any>(`${environment.apiUrl}/trades`, { params: { mode } })
      .subscribe((response) => {
        // ignore a response for a mode the user has already switched away from
        if (this.tradeMode.mode() === mode) this.trades.set(response.trades);
      });
  }

  setFilter<K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.setPage(1);
  }

  setPage(page: number) {
    this.page.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(size));
    } catch {}
    this.setPage(1);
  }

  setMonth(month: YearMonth) {
    this.viewedMonth.set(month);
    this.setPage(1);
  }

  readonly outcomeFilters: { value: Outcome; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'wins', label: 'Wins' },
    { value: 'losses', label: 'Losses' },
    { value: 'be', label: 'BE' },
  ];

  setOutcomeFilter(value: Outcome) {
    this.setFilter('outcome', value);
  }

  clearFilters() {
    this.filters.set({ ...NO_FILTERS });
    this.setPage(1);
  }

  // First click on a column: date and P/L sort high-to-low, grade sorts best first
  sortBy(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'grade' ? 'asc' : 'desc');
    }
    this.setPage(1);
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) return '↕';
    if (key === 'grade') return this.sortDir() === 'asc' ? '↓' : '↑';
    return this.sortDir() === 'desc' ? '↓' : '↑';
  }

  // "Oct 8" for the phone cards
  cardDate(date: string): string {
    const [, m, d] = date.slice(0, 10).split('-').map(Number);
    return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
  }

  hold(trade: any): string {
    return tradeDuration(trade.entry_time, trade.exit_time) ?? '—';
  }

  isBadEmotion(emotion: string | null): boolean {
    return !!emotion && BAD_EMOTIONS.has(emotion);
  }

  readonly emotionsOf = emotionsOf;
  readonly formatR = formatR;

  isBreakEven(trade: any): boolean {
    return outcomeOf(trade) === 'be';
  }

  isLowGrade(grade: string | null): boolean {
    return !!grade && LOW_GRADES.has(grade);
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  viewTrade(id: number) {
    this.router.navigate(['/trades', id]);
  }

  openNewTradeModal() {
    this.showNewTradeModal.set(true);
  }
  closeNewTradeModal() {
    this.showNewTradeModal.set(false);
  }
  onTradeCreated() {
    this.showNewTradeModal.set(false);
    this.loadTrades();
  }

  // "Save and add another": refresh the list behind the still-open form
  onTradeAdded() {
    this.loadTrades();
  }
}
