import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { ModeBadge, TradeMode, TradeModeService } from '../trade-mode';
import { buildMistakeCost, Mistake } from '../mistakes/mistakes';
import { TagGroupsEditor } from '../tags/tag-groups-editor';
import { todayLocal } from '../trade-journal';
import {
  DateRange,
  rangeDates,
  RangeKey,
  RANGE_OPTIONS,
  tradesInRange,
} from '../reports/report-logic';
import {
  Impact,
  mistakeRows,
  QuestionStats,
  RULE_CATEGORIES,
  RuleStat,
  RuleStats,
  weakestQuestion,
  weakestRule,
} from './playbook-logic';

@Component({
  imports: [FormsModule, DecimalPipe, ModeBadge, TagGroupsEditor],
  selector: 'app-playbook',
  styleUrl: './playbook.css',
  templateUrl: './playbook.html',
})
export class Playbook implements OnInit {
  private http = inject(HttpClient);
  private tradeMode = inject(TradeModeService);

  rules = signal<any[]>([]);
  questions = signal<any[]>([]);
  mistakes = signal<Mistake[]>([]);
  trades = signal<any[]>([]);
  ruleStats = signal<RuleStats | null>(null);
  questionStats = signal<QuestionStats | null>(null);

  // Stats on this page cover one range; managing rules etc. isn't affected by it
  readonly rangeOptions = RANGE_OPTIONS.filter((o) => o.key !== 'custom');
  range = signal<RangeKey>('all');
  readonly dates = computed<DateRange>(() => rangeDates(this.range(), todayLocal()));
  readonly rangeTrades = computed(() => tradesInRange(this.trades(), this.dates()));

  readonly categories = RULE_CATEGORIES;
  readonly ruleStatById = computed(
    () => new Map((this.ruleStats()?.adherence ?? []).map((s) => [s.ruleId, s])),
  );
  readonly weakest = computed(() => weakestRule(this.ruleStats()?.adherence ?? []));
  readonly weakQuestion = computed(() => weakestQuestion(this.questionStats()?.questions ?? []));
  readonly questionStatById = computed(
    () => new Map((this.questionStats()?.questions ?? []).map((q) => [q.id, q])),
  );
  readonly cost = computed(() => buildMistakeCost(this.rangeTrades(), this.mistakes()));
  readonly mistakeTable = computed(() => mistakeRows(this.cost(), this.mistakes()));
  readonly impactLabel: Record<Impact, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'No cost',
    unused: 'Not used',
  };

  newRuleName = '';
  newRuleDescription = '';
  newRuleCategory = '';
  newQuestionText = '';
  errorMessage = signal('');

  editingRuleId = signal<number | null>(null);
  editRuleName = '';
  editRuleDescription = '';
  editRuleCategory = '';

  newMistakeName = '';
  editingMistakeId = signal<number | null>(null);
  editMistakeName = '';

  editingQuestionId = signal<number | null>(null);
  editQuestionText = '';

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  ngOnInit() {
    this.loadRules();
    this.loadQuestions();
  }

  // Rules and questions are shared; their stats follow the live/backtest switch and the range
  constructor() {
    effect(() => {
      const mode = this.tradeMode.mode();
      this.loadMistakes(mode);
      this.loadTrades(mode);
    });
    effect(() => this.loadStats(this.tradeMode.mode(), this.dates()));
  }

  private rangeParams(mode: TradeMode, dates: DateRange) {
    const params: Record<string, string> = { mode };
    if (dates.from) params['from'] = dates.from;
    if (dates.to) params['to'] = dates.to;
    return params;
  }

  private isCurrent(mode: TradeMode, dates: DateRange) {
    const now = this.dates();
    return this.tradeMode.mode() === mode && now.from === dates.from && now.to === dates.to;
  }

  loadRules() {
    this.http
      .get<any>(`${environment.apiUrl}/rules`, this.authHeaders())
      .subscribe((response) => this.rules.set(response.rules));
  }

  loadQuestions() {
    this.http
      .get<any>(`${environment.apiUrl}/questions`, this.authHeaders())
      .subscribe((response) => this.questions.set(response.questions));
  }

  private loadTrades(mode: TradeMode) {
    this.http
      .get<any>(`${environment.apiUrl}/trades`, { ...this.authHeaders(), params: { mode } })
      .subscribe((response) => {
        if (this.tradeMode.mode() === mode) this.trades.set(response.trades);
      });
  }

  private loadStats(mode: TradeMode, dates: DateRange) {
    const params = this.rangeParams(mode, dates);
    this.http
      .get<RuleStats>(`${environment.apiUrl}/rule-adherence`, { ...this.authHeaders(), params })
      .subscribe((response) => this.isCurrent(mode, dates) && this.ruleStats.set(response));
    this.http
      .get<QuestionStats>(`${environment.apiUrl}/question-stats`, {
        ...this.authHeaders(),
        params,
      })
      .subscribe((response) => this.isCurrent(mode, dates) && this.questionStats.set(response));
  }

  // Rule and question stats come from the API, so ask again after a change
  private refreshStats() {
    this.loadStats(this.tradeMode.mode(), this.dates());
  }

  ruleStat(id: number): RuleStat | undefined {
    return this.ruleStatById().get(id);
  }

  addRule() {
    this.errorMessage.set('');
    if (!this.newRuleName.trim()) return;

    this.http
      .post<any>(
        `${environment.apiUrl}/rules`,
        {
          name: this.newRuleName,
          description: this.newRuleDescription,
          category: this.newRuleCategory || null,
        },
        this.authHeaders(),
      )
      .subscribe({
        next: (newRule) => {
          this.rules.update((current) => [...current, newRule]);
          this.newRuleName = '';
          this.newRuleDescription = '';
          this.newRuleCategory = '';
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong adding the rule.');
        },
      });
  }

  deleteRule(id: number) {
    if (!confirm('Delete this rule? Any trades linked to it will lose that link.')) return;
    this.http.delete<any>(`${environment.apiUrl}/rules/${id}`, this.authHeaders()).subscribe(() => {
      this.rules.update((current) => current.filter((r) => r.id !== id));
      this.refreshStats();
    });
  }

  startEditRule(rule: any) {
    this.editingRuleId.set(rule.id);
    this.editRuleName = rule.name;
    this.editRuleDescription = rule.description ?? '';
    this.editRuleCategory = rule.category ?? '';
  }

  cancelEditRule() {
    this.editingRuleId.set(null);
  }

  saveEditRule(id: number) {
    if (!this.editRuleName.trim()) return;
    this.http
      .put<any>(
        `${environment.apiUrl}/rules/${id}`,
        {
          name: this.editRuleName,
          description: this.editRuleDescription,
          category: this.editRuleCategory || null,
        },
        this.authHeaders(),
      )
      .subscribe({
        next: (saved) => {
          this.rules.update((current) => current.map((r) => (r.id === id ? saved : r)));
          this.editingRuleId.set(null);
          this.refreshStats();
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong updating the rule.');
        },
      });
  }

  // Counts are trades in the current live/backtest mode
  loadMistakes(mode: TradeMode) {
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`, { ...this.authHeaders(), params: { mode } })
      .subscribe((response) => {
        if (this.tradeMode.mode() === mode) this.mistakes.set(response.mistakes);
      });
  }

  addMistake() {
    this.errorMessage.set('');
    if (!this.newMistakeName.trim()) return;
    this.http
      .post<Mistake>(
        `${environment.apiUrl}/mistakes`,
        { name: this.newMistakeName },
        this.authHeaders(),
      )
      .subscribe({
        next: (created) => {
          this.mistakes.update((current) => [...current, created]);
          this.newMistakeName = '';
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong adding the mistake.');
        },
      });
  }

  deleteMistake(mistake: { id: number; name: string; count?: number }) {
    const used = mistake.count
      ? ` It will be removed from ${mistake.count} ${mistake.count === 1 ? 'trade' : 'trades'}.`
      : '';
    if (!confirm(`Delete "${mistake.name}"?${used}`)) return;
    this.http
      .delete(`${environment.apiUrl}/mistakes/${mistake.id}`, this.authHeaders())
      .subscribe(() =>
        this.mistakes.update((current) => current.filter((m) => m.id !== mistake.id)),
      );
  }

  startEditMistake(mistake: { id: number; name: string }) {
    this.editingMistakeId.set(mistake.id);
    this.editMistakeName = mistake.name;
  }

  cancelEditMistake() {
    this.editingMistakeId.set(null);
  }

  saveEditMistake(id: number) {
    this.errorMessage.set('');
    if (!this.editMistakeName.trim()) return;
    this.http
      .put<Mistake>(
        `${environment.apiUrl}/mistakes/${id}`,
        { name: this.editMistakeName },
        this.authHeaders(),
      )
      .subscribe({
        next: (updated) => {
          this.mistakes.update((current) =>
            current.map((m) => (m.id === id ? { ...m, name: updated.name } : m)),
          );
          this.editingMistakeId.set(null);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong updating the mistake.');
        },
      });
  }

  addQuestion() {
    this.errorMessage.set('');
    if (!this.newQuestionText.trim()) return;

    this.http
      .post<any>(
        `${environment.apiUrl}/questions`,
        { question_text: this.newQuestionText },
        this.authHeaders(),
      )
      .subscribe({
        next: (newQuestion) => {
          this.questions.update((current) => [...current, newQuestion]);
          this.newQuestionText = '';
          this.refreshStats();
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong adding the question.');
        },
      });
  }

  deleteQuestion(id: number) {
    if (
      !confirm(
        'Delete this question? Any saved answers for it will remain, but it will no longer appear on trades.',
      )
    )
      return;
    this.http
      .delete<any>(`${environment.apiUrl}/questions/${id}`, this.authHeaders())
      .subscribe(() => {
        this.questions.update((current) => current.filter((q) => q.id !== id));
        this.refreshStats();
      });
  }

  startEditQuestion(q: any) {
    this.editingQuestionId.set(q.id);
    this.editQuestionText = q.question_text;
  }

  cancelEditQuestion() {
    this.editingQuestionId.set(null);
  }

  saveEditQuestion(id: number) {
    if (!this.editQuestionText.trim()) return;
    this.http
      .put<any>(
        `${environment.apiUrl}/questions/${id}`,
        { question_text: this.editQuestionText },
        this.authHeaders(),
      )
      .subscribe({
        next: () => {
          this.questions.update((current) =>
            current.map((q) => (q.id === id ? { ...q, question_text: this.editQuestionText } : q)),
          );
          this.editingQuestionId.set(null);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong updating the question.');
        },
      });
  }

  pct(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  absValue(n: number): number {
    return Math.abs(n);
  }
}
