import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-trade-details',
  styleUrl: './trade-details.css',
  templateUrl: './trade-details.html',
})
export class TradeDetails implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  tradeId = '';
  trade = signal<any>(null);
  allRules = signal<any[]>([]);
  linkedRules = signal<any[]>([]);
  allQuestions = signal<any[]>([]);
  answers = signal<any[]>([]);

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

  loadQuestions() {
    this.http
      .get<any>('http://localhost:3001/questions', this.authHeaders())
      .subscribe((response) => this.allQuestions.set(response.questions));

    this.http
      .get<any>(`http://localhost:3001/trades/${this.tradeId}/answers`, this.authHeaders())
      .subscribe((response) => this.answers.set(response.answers));
  }

  isRuleLinked(ruleId: number): boolean {
    return this.linkedRules().some((r) => r.id === ruleId);
  }

  isRuleFollowed(ruleId: number): boolean {
    const linked = this.linkedRules().find((r) => r.id === ruleId);
    return linked ? linked.followed : false;
  }

  toggleRule(ruleId: number, event: Event) {
    const followed = (event.target as HTMLInputElement).checked;

    if (this.isRuleLinked(ruleId)) {
      this.http
        .put<any>(
          `http://localhost:3001/trades/${this.tradeId}/rules/${ruleId}`,
          { followed },
          this.authHeaders(),
        )
        .subscribe(() => this.loadRules());
    } else {
      this.http
        .post<any>(
          'http://localhost:3001/trade-rules',
          { trade_id: this.tradeId, rule_id: ruleId, followed },
          this.authHeaders(),
        )
        .subscribe(() => this.loadRules());
    }
  }

  getAnswer(questionId: number) {
    return this.answers().find((a) => a.question_id === questionId);
  }

  saveAnswer(questionId: number, choice: string, comment: string) {
    const existing = this.getAnswer(questionId);

    if (existing) {
      this.http
        .put<any>(
          `http://localhost:3001/trades/${this.tradeId}/answers/${questionId}`,
          { choice, comment },
          this.authHeaders(),
        )
        .subscribe(() => this.loadQuestions());
    } else {
      this.http
        .post<any>(
          'http://localhost:3001/trade-answers',
          { trade_id: this.tradeId, question_id: questionId, choice, comment },
          this.authHeaders(),
        )
        .subscribe(() => this.loadQuestions());
    }
  }
}
