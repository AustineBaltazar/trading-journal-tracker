import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

interface DraftAnswer {
  choice: string;
  comment: string;
}

@Component({
  imports: [FormsModule, RouterLink, DecimalPipe, SlicePipe],
  selector: 'app-trade-details',
  styleUrl: './trade-details.css',
  templateUrl: './trade-details.html',
})
export class TradeDetails implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  tradeId = '';
  trade = signal<any>(null);
  allRules = signal<any[]>([]);
  linkedRules = signal<any[]>([]);
  allQuestions = signal<any[]>([]);
  answers = signal<any[]>([]);

  draftAnswers = signal<Map<number, DraftAnswer>>(new Map());
  saveStatus = signal<'idle' | 'saving' | 'success' | 'error'>('idle');

  ngOnInit() {
    this.tradeId = this.route.snapshot.paramMap.get('id')!;
    this.loadTrade();
    this.loadRules();
    this.loadQuestions();
  }

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  loadTrade() {
    this.http
      .get<any>(`http://localhost:3001/trades/${this.tradeId}`, this.authHeaders())
      .subscribe((trade) => this.trade.set(trade));
  }

  loadRules() {
    this.http
      .get<any>('http://localhost:3001/rules', this.authHeaders())
      .subscribe((response) => this.allRules.set(response.rules));

    this.http
      .get<any>(`http://localhost:3001/trades/${this.tradeId}/rules`, this.authHeaders())
      .subscribe((response) => this.linkedRules.set(response.rules));
  }

  followedRulesOnly() {
    return this.linkedRules().filter((r) => r.followed);
  }

  ruleAdherenceLabel(): string {
    const total = this.linkedRules().length;
    const followed = this.followedRulesOnly().length;
    const pct = total > 0 ? Math.round((followed / total) * 100) : 0;
    return `${followed}/${total} followed (${pct}%)`;
  }

  grossPnl(): number {
    const t = this.trade();
    if (!t) return 0;
    return Math.round((t.netPnl + Number(t.fees)) * 100) / 100;
  }

  loadQuestions() {
    this.http
      .get<any>('http://localhost:3001/questions', this.authHeaders())
      .subscribe((response) => this.allQuestions.set(response.questions));

    this.http
      .get<any>(`http://localhost:3001/trades/${this.tradeId}/answers`, this.authHeaders())
      .subscribe((response) => {
        this.answers.set(response.answers);
        const draft = new Map<number, DraftAnswer>();
        for (const a of response.answers) {
          draft.set(a.question_id, { choice: a.choice, comment: a.comment || '' });
        }
        this.draftAnswers.set(draft);
      });
  }

  getAnswer(questionId: number) {
    return this.answers().find((a) => a.question_id === questionId);
  }

  getDraftChoice(questionId: number): string {
    return this.draftAnswers().get(questionId)?.choice || '';
  }

  getDraftComment(questionId: number): string {
    return this.draftAnswers().get(questionId)?.comment || '';
  }

  setDraftChoice(questionId: number, choice: string) {
    this.draftAnswers.update((current) => {
      const next = new Map(current);
      const existing = next.get(questionId);
      next.set(questionId, { choice, comment: existing?.comment || '' });
      return next;
    });
  }

  setDraftComment(questionId: number, comment: string) {
    this.draftAnswers.update((current) => {
      const next = new Map(current);
      const existing = next.get(questionId);
      next.set(questionId, { choice: existing?.choice || '', comment });
      return next;
    });
  }

  saveAllAnswers() {
    const entries = Array.from(this.draftAnswers().entries()).filter(([, a]) => a.choice);
    if (entries.length === 0) return;

    this.saveStatus.set('saving');
    let remaining = entries.length;
    let hadError = false;

    for (const [questionId, draft] of entries) {
      const existing = this.getAnswer(questionId);
      const request = existing
        ? this.http.put<any>(
            `http://localhost:3001/trades/${this.tradeId}/answers/${questionId}`,
            { choice: draft.choice, comment: draft.comment },
            this.authHeaders(),
          )
        : this.http.post<any>(
            'http://localhost:3001/trade-answers',
            {
              trade_id: this.tradeId,
              question_id: questionId,
              choice: draft.choice,
              comment: draft.comment,
            },
            this.authHeaders(),
          );

      request.subscribe({
        next: () => {
          remaining -= 1;
          if (remaining === 0) this.finishSave(hadError);
        },
        error: () => {
          hadError = true;
          remaining -= 1;
          if (remaining === 0) this.finishSave(hadError);
        },
      });
    }
  }

  private finishSave(hadError: boolean) {
    this.saveStatus.set(hadError ? 'error' : 'success');
    this.loadQuestions();
    setTimeout(() => this.saveStatus.set('idle'), 2500);
  }

  deleteTrade() {
    this.http
      .delete<any>(`http://localhost:3001/trades/${this.tradeId}`, this.authHeaders())
      .subscribe(() => this.router.navigate(['/trades']));
  }
}
