import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ModeBadge, TradeMode, TradeModeService } from '../trade-mode';
import { Mistake } from '../mistakes/mistakes';
import { TagGroupsEditor } from '../tags/tag-groups-editor';

@Component({
  imports: [FormsModule, ModeBadge, TagGroupsEditor],
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
  overallCompliance = signal<number | null>(null);

  newRuleName = '';
  newQuestionText = '';
  errorMessage = signal('');

  editingRuleId = signal<number | null>(null);
  editRuleName = '';

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

  // Rules and questions are shared; compliance follows the live/backtest switch
  constructor() {
    effect(() => {
      const mode = this.tradeMode.mode();
      this.loadCompliance(mode);
      this.loadMistakes(mode);
    });
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

  loadCompliance(mode: TradeMode) {
    this.http
      .get<any>(`${environment.apiUrl}/rule-adherence`, { ...this.authHeaders(), params: { mode } })
      .subscribe((response) => {
        if (this.tradeMode.mode() !== mode) return;
        this.overallCompliance.set(
          typeof response.followedAllPercentage === 'number'
            ? response.followedAllPercentage
            : null,
        );
      });
  }

  addRule() {
    this.errorMessage.set('');
    if (!this.newRuleName.trim()) return;

    this.http
      .post<any>(`${environment.apiUrl}/rules`, { name: this.newRuleName }, this.authHeaders())
      .subscribe({
        next: (newRule) => {
          this.rules.update((current) => [...current, newRule]);
          this.newRuleName = '';
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong adding the rule.');
        },
      });
  }

  deleteRule(id: number) {
    if (!confirm('Delete this rule? Any trades linked to it will lose that link.')) return;
    this.http
      .delete<any>(`${environment.apiUrl}/rules/${id}`, this.authHeaders())
      .subscribe(() => this.rules.update((current) => current.filter((r) => r.id !== id)));
  }

  startEditRule(rule: any) {
    this.editingRuleId.set(rule.id);
    this.editRuleName = rule.name;
  }

  cancelEditRule() {
    this.editingRuleId.set(null);
  }

  saveEditRule(id: number) {
    if (!this.editRuleName.trim()) return;
    this.http
      .put<any>(
        `${environment.apiUrl}/rules/${id}`,
        { name: this.editRuleName },
        this.authHeaders(),
      )
      .subscribe({
        next: () => {
          this.rules.update((current) =>
            current.map((r) => (r.id === id ? { ...r, name: this.editRuleName } : r)),
          );
          this.editingRuleId.set(null);
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

  deleteMistake(mistake: Mistake) {
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

  startEditMistake(mistake: Mistake) {
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
      .subscribe(() => this.questions.update((current) => current.filter((q) => q.id !== id)));
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
}
