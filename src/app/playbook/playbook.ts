import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ModeBadge, TradeMode, TradeModeService } from '../trade-mode';

@Component({
  imports: [FormsModule, ModeBadge],
  selector: 'app-playbook',
  styleUrl: './playbook.css',
  templateUrl: './playbook.html',
})
export class Playbook implements OnInit {
  private http = inject(HttpClient);
  private tradeMode = inject(TradeModeService);

  rules = signal<any[]>([]);
  questions = signal<any[]>([]);
  overallCompliance = signal<number | null>(null);

  newRuleName = '';
  newQuestionText = '';
  errorMessage = '';

  editingRuleId = signal<number | null>(null);
  editRuleName = '';

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
    effect(() => this.loadCompliance(this.tradeMode.mode()));
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
    this.errorMessage = '';
    if (!this.newRuleName.trim()) return;

    this.http
      .post<any>(`${environment.apiUrl}/rules`, { name: this.newRuleName }, this.authHeaders())
      .subscribe({
        next: (newRule) => {
          this.rules.update((current) => [...current, newRule]);
          this.newRuleName = '';
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong adding the rule.';
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
          this.errorMessage = err.error?.error || 'Something went wrong updating the rule.';
        },
      });
  }

  addQuestion() {
    this.errorMessage = '';
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
          this.errorMessage = err.error?.error || 'Something went wrong adding the question.';
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
          this.errorMessage = err.error?.error || 'Something went wrong updating the question.';
        },
      });
  }
}
