import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { MistakePicker } from '../mistakes/mistakes';
import { emotionsOf } from '../outcome';
import { TagPicker } from '../tags/tags';
import { EmotionPicker, ResultPicker } from '../trade-form-fields';
import { ImageGallery } from '../image-gallery/image-gallery';
import { AnswerChoice, TradeFormBase } from '../trade-form/trade-form-base';

@Component({
  imports: [
    FormsModule,
    DecimalPipe,
    MistakePicker,
    ResultPicker,
    EmotionPicker,
    ImageGallery,
    TagPicker,
  ],
  selector: 'app-edit-trade',
  styleUrl: '../trade-form/trade-form.css',
  templateUrl: '../trade-form/trade-form.html',
})
export class EditTrade extends TradeFormBase implements OnChanges {
  @Input({ required: true }) tradeId!: number;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly isEdit = true;
  // Questions that already have an answer are updated, the rest created
  private answeredBefore = new Set<number>();

  ngOnChanges() {
    if (!this.tradeId) return;
    this.loaded.set(false);
    // Screenshots upload straight away here, since the trade already exists
    this.imageTarget = {
      base: `${environment.apiUrl}/trades/${this.tradeId}/images`,
      item: `${environment.apiUrl}/trade-images`,
    };
    this.loadTrade();
    this.loadRules();
    this.loadLists();
    this.http
      .get<any>(`${environment.apiUrl}/trades/${this.tradeId}/answers`, this.authHeaders())
      .subscribe((response) => {
        const answers = new Map<number, AnswerChoice>();
        for (const a of response.answers ?? []) {
          if (a.choice) answers.set(a.question_id, a.choice);
        }
        this.answeredBefore = new Set(answers.keys());
        this.answers.set(answers);
      });
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
        this.emotions = emotionsOf(trade);
        this.grade = trade.grade || '';
        this.result = trade.result ?? null;
        this.stop_price = trade.stop_price;
        this.target_price = trade.target_price;
        this.selectedTagIds.set(new Set(trade.tagIds || []));
        this.images.set(trade.images || []);
        this.mode = trade.mode === 'backtest' ? 'backtest' : 'live';
        this.selectedMistakeIds.set(new Set(trade.mistakeIds || []));
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

  onSubmit(_addAnother = false) {
    if (this.saving() || !this.validate()) return;
    this.saving.set(true);
    this.rememberFees();
    this.http
      .put<any>(`${environment.apiUrl}/trades/${this.tradeId}`, this.payload(), this.authHeaders())
      .subscribe({
        next: () => this.saveLists(),
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err.error?.error || 'Something went wrong updating the trade.');
        },
      });
  }

  // Mistakes and tags are always sent, so clearing every chip clears them;
  // then the answers, then the rules
  private saveLists() {
    const put = (path: string, body: object, next: () => void) =>
      this.http
        .put(`${environment.apiUrl}/trades/${this.tradeId}/${path}`, body, this.authHeaders())
        .subscribe({ next, error: next });
    put('mistakes', { mistake_ids: [...this.selectedMistakeIds()] }, () =>
      put('tags', { tag_ids: [...this.selectedTagIds()] }, () =>
        this.saveAnswers(() => this.syncRules()),
      ),
    );
  }

  private saveAnswers(done: () => void) {
    const entries = [...this.answers().entries()];
    if (entries.length === 0) {
      done();
      return;
    }
    let remaining = entries.length;
    const one = () => {
      remaining -= 1;
      if (remaining === 0) done();
    };
    for (const [questionId, choice] of entries) {
      const request = this.answeredBefore.has(questionId)
        ? this.http.put(
            `${environment.apiUrl}/trades/${this.tradeId}/answers/${questionId}`,
            { choice, comment: null },
            this.authHeaders(),
          )
        : this.http.post(
            `${environment.apiUrl}/trade-answers`,
            { trade_id: this.tradeId, question_id: questionId, choice, comment: null },
            this.authHeaders(),
          );
      request.subscribe({ next: one, error: one });
    }
  }

  private syncRules() {
    const allRules = this.allRules();
    const finish = () => {
      this.saving.set(false);
      this.saved.emit();
    };
    if (allRules.length === 0) {
      finish();
      return;
    }

    this.http
      .get<any>(`${environment.apiUrl}/trades/${this.tradeId}/rules`, this.authHeaders())
      .subscribe((linkedResponse) => {
        const linkedIds = new Set<number>(linkedResponse.rules.map((r: any) => r.id));
        let remaining = allRules.length;
        const done = () => {
          remaining -= 1;
          if (remaining === 0) finish();
        };
        for (const rule of allRules) {
          const followed = this.checkedRuleIds().has(rule.id);
          const request = linkedIds.has(rule.id)
            ? this.http.put<any>(
                `${environment.apiUrl}/trades/${this.tradeId}/rules/${rule.id}`,
                { followed },
                this.authHeaders(),
              )
            : this.http.post<any>(
                `${environment.apiUrl}/trade-rules`,
                { trade_id: this.tradeId, rule_id: rule.id, followed },
                this.authHeaders(),
              );
          request.subscribe({ next: done, error: done });
        }
      });
  }

  cancel() {
    this.cancelled.emit();
  }
}
