import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { MONTH_NAMES, todayLocal } from '../trade-journal';
import {
  DrawdownType,
  EvalAttempt,
  evalProgress,
  EvalRules,
  EvalTrade,
  PRESETS,
  STATUS_TEXT,
} from './eval-logic';

interface RulesForm {
  name: string;
  accountSize: number | null;
  profitTarget: number | null;
  maxDrawdown: number | null;
  drawdownType: DrawdownType;
  dailyLossLimit: number | null;
  minDays: number | null;
  consistencyPct: number | null;
  startedOn: string;
}

const FAIL_REASONS = ['Max drawdown', 'Daily loss limit', 'Consistency rule', 'Other rule'];

// Eval mode, top of the dashboard: what you can still lose today, the road to
// passing, and the rules / passed-failed dialogs
@Component({
  selector: 'app-eval-panel',
  imports: [FormsModule],
  templateUrl: './eval-panel.html',
  styles: `
    .ev-input {
      background: var(--color-tone-0e131c);
      border: 1px solid var(--color-tone-1f293d);
      border-radius: 0.5rem;
      padding: 0.4rem 0.6rem;
      font-size: 13px;
      color: var(--color-slate-200);
      width: 100%;
      min-width: 0;
    }
  `,
})
export class EvalPanel {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/evals`;
  readonly trades = input.required<EvalTrade[]>();
  readonly presets = PRESETS;
  readonly failReasons = FAIL_REASONS;
  readonly statusText = STATUS_TEXT;
  readonly Math = Math;

  loaded = signal(false);
  attempts = signal<EvalAttempt[]>([]);
  current = computed(() => this.attempts().find((a) => !a.endedOn) ?? null);
  today = todayLocal();
  progress = computed(() => {
    const a = this.current();
    return a ? evalProgress(a, this.trades(), this.today) : null;
  });
  // Tiles for the days still needed to meet the minimum
  neededTiles = computed(() => {
    const p = this.progress();
    return p ? Array.from({ length: Math.min(p.daysNeeded, 6) }, (_, i) => i) : [];
  });

  dialog = signal<'rules' | 'end' | null>(null);
  form = signal<RulesForm>(this.blankForm());
  editingId = signal<number | null>(null);
  endResult = signal<'passed' | 'failed' | null>(null);
  endReason = signal('');
  startNext = signal(true);
  saving = signal(false);
  error = signal('');

  constructor() {
    this.load();
  }

  load() {
    this.http.get<{ attempts: EvalAttempt[] }>(this.api).subscribe({
      next: (r) => {
        this.attempts.set(r.attempts);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  private blankForm(): RulesForm {
    return {
      name: '',
      accountSize: null,
      profitTarget: null,
      maxDrawdown: null,
      drawdownType: 'eod_trailing',
      dailyLossLimit: null,
      minDays: null,
      consistencyPct: null,
      startedOn: todayLocal(),
    };
  }

  // A new evaluation, filled from a preset (or blank)
  setUp(rules?: EvalRules) {
    this.editingId.set(null);
    this.form.set({ ...this.blankForm(), ...(rules ?? {}) });
    this.error.set('');
    this.dialog.set('rules');
  }

  editRules() {
    const a = this.current();
    if (!a) return;
    this.editingId.set(a.id);
    const { id, endedOn, result, failReason, ...rules } = a;
    this.form.set({ ...rules });
    this.error.set('');
    this.dialog.set('rules');
  }

  usePreset(key: string) {
    const preset = PRESETS.find((p) => p.key === key);
    if (preset) this.form.update((f) => ({ ...f, ...preset.rules }));
  }

  patch<K extends keyof RulesForm>(key: K, value: RulesForm[K]) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  saveRules() {
    const id = this.editingId();
    this.saving.set(true);
    this.error.set('');
    const body = this.form();
    const req = id
      ? this.http.put<{ attempt: EvalAttempt }>(`${this.api}/${id}`, body)
      : this.http.post<{ attempt: EvalAttempt }>(this.api, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.set(null);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? "Couldn't save. Try again.");
      },
    });
  }

  openEnd() {
    this.endResult.set(null);
    this.endReason.set('');
    this.startNext.set(true);
    this.error.set('');
    this.dialog.set('end');
  }

  endAttempt() {
    const a = this.current();
    const result = this.endResult();
    if (!a || !result) return;
    this.saving.set(true);
    this.http
      .post(`${this.api}/${a.id}/end`, {
        result,
        reason: result === 'failed' ? this.endReason() : null,
        startNext: this.startNext(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialog.set(null);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.error ?? "Couldn't save. Try again.");
        },
      });
  }

  // Attempts are numbered oldest first
  attemptNumber(a: EvalAttempt) {
    const list = this.attempts();
    return list.length - list.indexOf(a);
  }

  // Net P/L of an attempt, from its own date span
  attemptNet(a: EvalAttempt) {
    return evalProgress(a, this.trades(), this.today).profit;
  }

  money(n: number) {
    const abs = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}$${abs}`;
  }

  plain(n: number | null) {
    return n === null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`;
  }

  // "Mon 13", "Oct 13"
  dayLabel(date: string) {
    const d = new Date(`${date}T12:00:00`);
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getDate()}`;
  }

  shortDate(date: string | null) {
    if (!date) return 'now';
    return `${MONTH_NAMES[Number(date.slice(5, 7)) - 1].slice(0, 3)} ${Number(date.slice(8, 10))}`;
  }

  todayLabel() {
    const d = new Date(`${this.today}T12:00:00`);
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${this.shortDate(this.today)}`;
  }

  // Bar fill for what's already used of a limit
  usedPct(left: number | null, limit: number | null) {
    if (left === null || !limit) return 0;
    return Math.max(0, Math.min(100, Math.round(((limit - left) / limit) * 100)));
  }

  dangerClass(left: number | null, limit: number | null) {
    const used = this.usedPct(left, limit);
    return used >= 75 ? 'bg-rose-500' : used >= 40 ? 'bg-amber-500' : 'bg-emerald-500';
  }
}
