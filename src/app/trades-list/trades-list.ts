import { Component, effect, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewTrade } from '../new-trade/new-trade';
import { MonthPicker } from '../month-picker/month-picker';
import { ModeBadge, TradeModeService } from '../trade-mode';
import { Mistake } from '../mistakes/mistakes';
import { emotionsOf, outcomeOf } from '../outcome';
import { environment } from '../../environments/environment';
import {
  currentMonth,
  EMOTIONS,
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

@Component({
  imports: [SlicePipe, DecimalPipe, FormsModule, NewTrade, MonthPicker, ModeBadge],
  selector: 'app-trades-list',
  styleUrl: './trades-list.css',
  templateUrl: './trades-list.html',
})
export class TradesList {
  private http = inject(HttpClient);
  private router = inject(Router);
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

  // Summary bar follows the filters, so filtering to a session shows that session's stats
  summary = computed(() => summarizeTrades(this.filteredTrades()));

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
      .get<any>(`${environment.apiUrl}/mistakes`, this.authHeaders())
      .subscribe((response) => this.mistakes.set(response.mistakes));
  }

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  loadTrades(mode = this.tradeMode.mode()) {
    this.http
      .get<any>(`${environment.apiUrl}/trades`, { ...this.authHeaders(), params: { mode } })
      .subscribe((response) => {
        // ignore a response for a mode the user has already switched away from
        if (this.tradeMode.mode() === mode) this.trades.set(response.trades);
      });
  }

  setFilter<K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) {
    this.filters.update((f) => ({ ...f, [key]: value }));
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
  }

  // First click on a column: date and P/L sort high-to-low, grade sorts best first
  sortBy(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'grade' ? 'asc' : 'desc');
    }
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) return '↕';
    if (key === 'grade') return this.sortDir() === 'asc' ? '↓' : '↑';
    return this.sortDir() === 'desc' ? '↓' : '↑';
  }

  hold(trade: any): string {
    return tradeDuration(trade.entry_time, trade.exit_time) ?? '—';
  }

  isBadEmotion(emotion: string | null): boolean {
    return !!emotion && BAD_EMOTIONS.has(emotion);
  }

  readonly emotionsOf = emotionsOf;

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
