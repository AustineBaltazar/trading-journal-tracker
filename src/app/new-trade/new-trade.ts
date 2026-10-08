import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { EventEmitter, Output } from '@angular/core';
import { environment } from '../../environments/environment';
import { EMOTIONS, GRADES, SESSIONS, tradeDuration } from '../trade-journal';

@Component({
  imports: [FormsModule],
  selector: 'app-new-trade',
  styleUrl: './new-trade.css',
  templateUrl: './new-trade.html',
})
export class NewTrade implements OnInit {
  private http = inject(HttpClient);

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  trade_date = '';
  symbol = 'MNQ';
  direction = 'long';
  contracts = 1;
  entry_price = 0;
  exit_price = 0;
  fees = 0;
  strategy = '';
  screenshot_link = '';
  notes = '';
  entry_time = '';
  exit_time = '';
  session = '';
  emotion = '';
  grade = '';

  readonly sessions = SESSIONS;
  readonly emotions = EMOTIONS;
  readonly grades = GRADES;

  get duration(): string | null {
    return tradeDuration(this.entry_time, this.exit_time);
  }

  errorMessage = '';

  allRules = signal<any[]>([]);
  checkedRuleIds = signal<Set<number>>(new Set());

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/rules`, this.authHeaders()).subscribe((response) => {
      this.allRules.set(response.rules);
      this.checkedRuleIds.set(new Set(response.rules.map((r: any) => r.id)));
    });
  }

  isRuleChecked(ruleId: number): boolean {
    return this.checkedRuleIds().has(ruleId);
  }

  toggleRuleChecked(ruleId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.checkedRuleIds.update((current) => {
      const next = new Set(current);
      if (checked) next.add(ruleId);
      else next.delete(ruleId);
      return next;
    });
  }

  setDirection(value: string) {
    this.direction = value;
  }

  onSubmit() {
    this.errorMessage = '';

    if (!this.trade_date) {
      this.errorMessage = 'Please select a date.';
      return;
    }

    this.http
      .post<any>(
        `${environment.apiUrl}/trades`,
        {
          trade_date: this.trade_date,
          symbol: this.symbol,
          direction: this.direction,
          contracts: this.contracts,
          entry_price: this.entry_price,
          exit_price: this.exit_price,
          fees: this.fees,
          strategy: this.strategy,
          screenshot_link: this.screenshot_link || null,
          notes: this.notes || null,
          entry_time: this.entry_time || null,
          exit_time: this.exit_time || null,
          session: this.session || null,
          emotion: this.emotion || null,
          grade: this.grade || null,
        },
        this.authHeaders(),
      )
      .subscribe({
        next: (newTrade) => this.linkRules(newTrade.id),
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong saving the trade.';
        },
      });
  }

  private linkRules(tradeId: number) {
    const allRules = this.allRules();

    if (allRules.length === 0) {
      this.saved.emit();
      return;
    }

    let remaining = allRules.length;
    for (const rule of allRules) {
      const followed = this.checkedRuleIds().has(rule.id);
      this.http
        .post<any>(
          `${environment.apiUrl}/trade-rules`,
          { trade_id: tradeId, rule_id: rule.id, followed },
          this.authHeaders(),
        )
        .subscribe({
          next: () => {
            remaining -= 1;
            if (remaining === 0) this.saved.emit();
          },
          error: () => {
            remaining -= 1;
            if (remaining === 0) this.saved.emit();
          },
        });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
