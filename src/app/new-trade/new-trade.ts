import { Component, ElementRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { EventEmitter, Output } from '@angular/core';
import { environment } from '../../environments/environment';
import { EMOTIONS, GRADES, SESSIONS, todayLocal, tradeDuration } from '../trade-journal';
import { TradeMode, TradeModeService } from '../trade-mode';
import { Mistake, MistakePicker } from '../mistakes/mistakes';

@Component({
  imports: [FormsModule, MistakePicker],
  selector: 'app-new-trade',
  styleUrl: './new-trade.css',
  templateUrl: './new-trade.html',
})
export class NewTrade implements OnInit {
  private http = inject(HttpClient);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  // saved: trade saved and the form should close
  // added: trade saved via "Save and add another"; the form stays open
  @Output() saved = new EventEmitter<void>();
  @Output() added = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  // Starts on the app's current live/backtest mode
  mode: TradeMode = inject(TradeModeService).mode();
  saving = signal(false);
  loggedCount = signal(0);

  trade_date = todayLocal();
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

  errorMessage = signal('');

  allRules = signal<any[]>([]);
  checkedRuleIds = signal<Set<number>>(new Set());
  mistakes = signal<Mistake[]>([]);
  selectedMistakeIds = signal<Set<number>>(new Set());

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/rules`, this.authHeaders()).subscribe((response) => {
      this.allRules.set(response.rules);
      this.checkedRuleIds.set(new Set(response.rules.map((r: any) => r.id)));
    });
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`, this.authHeaders())
      .subscribe((response) => this.mistakes.set(response.mistakes));
  }

  toggleMistake(id: number) {
    this.selectedMistakeIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

  setMode(value: TradeMode) {
    this.mode = value;
  }

  onSubmit(addAnother = false) {
    this.errorMessage.set('');
    if (this.saving()) return;

    if (!this.trade_date) {
      this.errorMessage.set('Please select a date.');
      return;
    }

    this.saving.set(true);

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
          mode: this.mode,
        },
        this.authHeaders(),
      )
      .subscribe({
        next: (newTrade) => this.linkExtras(newTrade.id, () => this.finish(addAnother)),
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err.error?.error || 'Something went wrong saving the trade.');
        },
      });
  }

  // Rules and mistakes are saved in parallel; done() runs once both finish
  private linkExtras(tradeId: number, done: () => void) {
    let pending = 2;
    const oneDone = () => {
      pending -= 1;
      if (pending === 0) done();
    };
    this.linkRules(tradeId, oneDone);
    this.saveMistakes(tradeId, oneDone);
  }

  private saveMistakes(tradeId: number, done: () => void) {
    const ids = [...this.selectedMistakeIds()];
    if (ids.length === 0) {
      done();
      return;
    }
    this.http
      .put(
        `${environment.apiUrl}/trades/${tradeId}/mistakes`,
        { mistake_ids: ids },
        this.authHeaders(),
      )
      .subscribe({ next: done, error: done });
  }

  private linkRules(tradeId: number, done: () => void) {
    const allRules = this.allRules();

    if (allRules.length === 0) {
      done();
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
            if (remaining === 0) done();
          },
          error: () => {
            remaining -= 1;
            if (remaining === 0) done();
          },
        });
    }
  }

  private finish(addAnother: boolean) {
    this.saving.set(false);
    if (!addAnother) {
      this.saved.emit();
      return;
    }
    this.loggedCount.update((n) => n + 1);
    this.resetForNextTrade();
    this.added.emit();
  }

  // Keeps the setup that repeats across a session (date, symbol, strategy,
  // session, direction, contracts, fees, mode) and clears the per-trade fields.
  resetForNextTrade() {
    this.entry_price = 0;
    this.exit_price = 0;
    this.entry_time = '';
    this.exit_time = '';
    this.emotion = '';
    this.grade = '';
    this.notes = '';
    this.screenshot_link = '';
    this.checkedRuleIds.set(new Set(this.allRules().map((r: any) => r.id)));
    this.selectedMistakeIds.set(new Set());
    // Focus the first cleared field with its 0 selected, so typing replaces it
    setTimeout(() => {
      const entry = this.host.nativeElement.querySelector<HTMLInputElement>('[name="entry_price"]');
      entry?.focus();
      entry?.select();
    });
  }

  cancel() {
    this.cancelled.emit();
  }
}
