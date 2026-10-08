import { Component, inject, Input, Output, EventEmitter, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { EMOTIONS, GRADES, SESSIONS, tradeDuration } from '../trade-journal';

@Component({
  imports: [FormsModule],
  selector: 'app-edit-trade',
  styleUrl: './edit-trade.css',
  templateUrl: './edit-trade.html',
})
export class EditTrade implements OnChanges {
  private http = inject(HttpClient);

  @Input({ required: true }) tradeId!: number;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  loaded = signal(false);
  errorMessage = '';

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

  allRules = signal<any[]>([]);
  checkedRuleIds = signal<Set<number>>(new Set());

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  ngOnChanges() {
    if (this.tradeId) {
      this.loaded.set(false);
      this.loadTrade();
      this.loadRules();
    }
  }

  loadTrade() {
    this.http
      .get<any>(`${environment.apiUrl}/trades/${this.tradeId}`, this.authHeaders())
      .subscribe((trade) => {
        this.trade_date = trade.trade_date.substring(0, 10);
        this.symbol = trade.symbol;
        this.direction = trade.direction;
        this.contracts = trade.contracts;
        this.entry_price = trade.entry_price;
        this.exit_price = trade.exit_price;
        this.fees = trade.fees;
        this.strategy = trade.strategy || '';
        this.screenshot_link = trade.screenshot_link || '';
        this.notes = trade.notes || '';
        this.entry_time = trade.entry_time || '';
        this.exit_time = trade.exit_time || '';
        this.session = trade.session || '';
        this.emotion = trade.emotion || '';
        this.grade = trade.grade || '';
        this.loaded.set(true);
      });
  }

  loadRules() {
    this.http.get<any>(`${environment.apiUrl}/rules`, this.authHeaders()).subscribe((response) => {
      this.allRules.set(response.rules);
      this.http
        .get<any>(`${environment.apiUrl}/trades/${this.tradeId}/rules`, this.authHeaders())
        .subscribe((linkedResponse) => {
          const checked = new Set<number>(
            linkedResponse.rules.filter((r: any) => r.followed).map((r: any) => r.id),
          );
          this.checkedRuleIds.set(checked);
        });
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
      .put<any>(
        `${environment.apiUrl}/trades/${this.tradeId}`,
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
        next: () => this.syncRules(),
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong updating the trade.';
        },
      });
  }

  private syncRules() {
    const allRules = this.allRules();
    if (allRules.length === 0) {
      this.saved.emit();
      return;
    }

    this.http
      .get<any>(`${environment.apiUrl}/trades/${this.tradeId}/rules`, this.authHeaders())
      .subscribe((linkedResponse) => {
        const linkedIds = new Set<number>(linkedResponse.rules.map((r: any) => r.id));
        let remaining = allRules.length;
        const done = () => {
          remaining -= 1;
          if (remaining === 0) this.saved.emit();
        };

        for (const rule of allRules) {
          const followed = this.checkedRuleIds().has(rule.id);
          if (linkedIds.has(rule.id)) {
            this.http
              .put<any>(
                `${environment.apiUrl}/trades/${this.tradeId}/rules/${rule.id}`,
                { followed },
                this.authHeaders(),
              )
              .subscribe({ next: done, error: done });
          } else {
            this.http
              .post<any>(
                `${environment.apiUrl}/trade-rules`,
                { trade_id: this.tradeId, rule_id: rule.id, followed },
                this.authHeaders(),
              )
              .subscribe({ next: done, error: done });
          }
        }
      });
  }

  cancel() {
    this.cancelled.emit();
  }
}
