import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  imports: [FormsModule],
  selector: 'app-playbook',
  styleUrl: './playbook.css',
  templateUrl: './playbook.html',
})
export class Playbook implements OnInit {
  private http = inject(HttpClient);

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
    this.loadCompliance();
  }

  loadRules() {
    this.http
      .get<any>('http://localhost:3001/rules', this.authHeaders())
      .subscribe((response) => this.rules.set(response.rules));
  }

  loadQuestions() {
    this.http
      .get<any>('http://localhost:3001/questions', this.authHeaders())
      .subscribe((response) => this.questions.set(response.questions));
  }

  loadCompliance() {
    this.http
      .get<any>('http://localhost:3001/rule-adherence', this.authHeaders())
      .subscribe((response) => {
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
      .post<any>('http://localhost:3001/rules', { name: this.newRuleName }, this.authHeaders())
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
      .delete<any>(`http://localhost:3001/rules/${id}`, this.authHeaders())
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
        `http://localhost:3001/rules/${id}`,
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
        'http://localhost:3001/questions',
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
      .delete<any>(`http://localhost:3001/questions/${id}`, this.authHeaders())
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
        `http://localhost:3001/questions/${id}`,
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
