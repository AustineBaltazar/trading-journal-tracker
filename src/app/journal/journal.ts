import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { MonthPicker } from '../month-picker/month-picker';
import { ModeBadge, TradeMode, TradeModeService } from '../trade-mode';
import { Mistake } from '../mistakes/mistakes';
import { monthKey, monthsWithTrades, todayLocal, YearMonth } from '../trade-journal';
import { JournalImages } from './journal-images';
import { buildCalendarMonth, dayStyle } from '../dashboard/calendar';
import {
  BIASES,
  DAY_GRADES,
  EMPTY_ENTRY,
  EntrySummary,
  focusSessionWarning,
  FOLLOWED,
  journalCounts,
  shortPnl,
  formatLongDate,
  JournalEntry,
  JournalImage,
  KeyLevel,
  MOODS,
} from './journal-logic';

const SAVE_DELAY_MS = 700;

@Component({
  imports: [DecimalPipe, RouterLink, MonthPicker, ModeBadge, JournalImages],
  selector: 'app-journal',
  templateUrl: './journal.html',
})
export class Journal implements OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly tradeMode = inject(TradeModeService);

  readonly biases = BIASES;
  readonly followed = FOLLOWED;
  readonly moods = MOODS;
  readonly grades = DAY_GRADES;
  readonly today = todayLocal();

  // ?date=YYYY-MM-DD picks the day; defaults to today
  readonly date = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => (/^\d{4}-\d{2}-\d{2}$/.test(p.get('date') ?? '') ? p.get('date')! : todayLocal())),
    ),
    { initialValue: todayLocal() },
  );
  listMonth = signal<YearMonth>(this.monthOf(todayLocal()));

  trades = signal<any[]>([]);
  monthEntries = signal<EntrySummary[]>([]);
  mistakes = signal<Mistake[]>([]);

  entry = signal<JournalEntry>({ ...EMPTY_ENTRY });
  images = signal<JournalImage[]>([]);
  loadingDay = signal(true);
  saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  savedAt = signal('');

  private pending: Partial<JournalEntry> = {};
  private pendingFor: { date: string; mode: TradeMode } | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly tradeMonths = computed(() => monthsWithTrades(this.trades()));
  // Mini calendar: same layout and P/L colours as the dashboard calendar
  readonly calendar = computed(() =>
    buildCalendarMonth(this.trades(), this.listMonth(), this.today),
  );
  readonly entryByDate = computed(
    () => new Map(this.monthEntries().map((e) => [e.date, e] as const)),
  );
  readonly counts = computed(() => journalCounts(this.monthEntries(), monthKey(this.listMonth())));
  readonly tradingDays = computed(
    () =>
      this.calendar()
        .weeks.flatMap((w) => w.days)
        .filter((d) => d && d.count > 0).length,
  );
  readonly dayStyle = dayStyle;
  readonly shortPnl = shortPnl;
  readonly dayTrades = computed(() =>
    this.trades()
      .filter((t) => t.trade_date.startsWith(this.date()))
      .sort((a, b) => (a.entry_time || '').localeCompare(b.entry_time || '')),
  );
  readonly dayPnl = computed(
    () => Math.round(this.dayTrades().reduce((s, t) => s + t.netPnl, 0) * 100) / 100,
  );
  readonly warning = computed(() => focusSessionWarning(this.entry().focus, this.dayTrades()));
  readonly title = computed(() => formatLongDate(this.date()));
  readonly preImages = computed(() => this.images().filter((i) => i.section === 'pre'));
  readonly postImages = computed(() => this.images().filter((i) => i.section === 'post'));

  constructor() {
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`, this.authHeaders())
      .subscribe((r) => this.mistakes.set(r.mistakes));

    // Trades for the selected mode (day list P/L and "what happened")
    effect(() => {
      const mode = this.tradeMode.mode();
      untracked(() => this.loadTrades(mode));
    });
    // Day list for the month being browsed
    effect(() => {
      const mode = this.tradeMode.mode();
      const month = this.listMonth();
      untracked(() => this.loadMonth(mode, month));
    });
    // The selected day: save anything unsaved for the previous day first
    effect(() => {
      const mode = this.tradeMode.mode();
      const date = this.date();
      untracked(() => {
        this.flushSave();
        this.listMonth.set(this.monthOf(date));
        this.loadDay(mode, date);
      });
    });
  }

  ngOnDestroy() {
    this.flushSave();
  }

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  private monthOf(date: string): YearMonth {
    return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 };
  }

  private loadTrades(mode: TradeMode) {
    this.http
      .get<any>(`${environment.apiUrl}/trades`, { ...this.authHeaders(), params: { mode } })
      .subscribe((r) => this.tradeMode.mode() === mode && this.trades.set(r.trades));
  }

  private loadMonth(mode: TradeMode, month: YearMonth) {
    this.http
      .get<any>(`${environment.apiUrl}/journal`, {
        ...this.authHeaders(),
        params: { mode, month: monthKey(month) },
      })
      .subscribe((r) => this.tradeMode.mode() === mode && this.monthEntries.set(r.entries));
  }

  private loadDay(mode: TradeMode, date: string) {
    this.loadingDay.set(true);
    this.saveState.set('idle');
    this.http
      .get<any>(`${environment.apiUrl}/journal/${date}`, {
        ...this.authHeaders(),
        params: { mode },
      })
      .subscribe((r) => {
        if (this.tradeMode.mode() !== mode || this.date() !== date) return;
        const e = r.entry ?? {};
        this.entry.set({
          ...EMPTY_ENTRY,
          ...Object.fromEntries(
            Object.keys(EMPTY_ENTRY).map((k) => [k, e[k] ?? (EMPTY_ENTRY as any)[k]]),
          ),
        } as JournalEntry);
        this.images.set(r.images);
        this.loadingDay.set(false);
      });
  }

  selectDate(date: string) {
    this.router.navigate([], { queryParams: { date }, queryParamsHandling: 'merge' });
  }

  // Updates a field and schedules an auto-save of everything changed since the last save
  set<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
    this.entry.update((e) => ({ ...e, [field]: value }));
    this.pending[field] = value;
    this.pendingFor = { date: this.date(), mode: this.tradeMode.mode() };
    this.saveState.set('saving');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), SAVE_DELAY_MS);
  }

  // Clicking the selected choice again clears it
  toggle<K extends 'bias' | 'followed_plan' | 'mood' | 'day_grade'>(field: K, value: string) {
    this.set(field, (this.entry()[field] === value ? null : value) as JournalEntry[K]);
  }

  flushSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.pendingFor || Object.keys(this.pending).length === 0) return;
    const { date, mode } = this.pendingFor;
    const body: any = { ...this.pending };
    if (body.key_levels)
      body.key_levels = (body.key_levels as KeyLevel[]).filter((l) => l.price > 0);
    this.pending = {};
    this.pendingFor = null;

    this.http
      .put<any>(`${environment.apiUrl}/journal/${date}`, body, {
        ...this.authHeaders(),
        params: { mode },
      })
      .subscribe({
        next: () => {
          if (date === this.date()) {
            this.saveState.set('saved');
            this.savedAt.set(
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            );
          }
          this.loadMonth(mode, this.listMonth());
        },
        error: () => date === this.date() && this.saveState.set('error'),
      });
  }

  addLevel() {
    this.set('key_levels', [...this.entry().key_levels, { price: 0, label: '' }]);
  }

  updateLevel(index: number, patch: Partial<KeyLevel>) {
    this.set(
      'key_levels',
      this.entry().key_levels.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  removeLevel(index: number) {
    this.set(
      'key_levels',
      this.entry().key_levels.filter((_, i) => i !== index),
    );
  }

  mistakeNames(ids: number[] | undefined): string[] {
    const set = new Set(ids || []);
    return this.mistakes()
      .filter((m) => set.has(m.id))
      .map((m) => m.name);
  }

  onImageAdded(image: JournalImage) {
    this.images.update((list) => [...list, image]);
    this.loadMonth(this.tradeMode.mode(), this.listMonth());
  }

  onImageRemoved(id: number) {
    this.images.update((list) => list.filter((i) => i.id !== id));
  }

  onCaptioned({ id, caption }: { id: number; caption: string | null }) {
    this.images.update((list) => list.map((i) => (i.id === id ? { ...i, caption } : i)));
  }

  abs(n: number) {
    return Math.abs(n);
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
