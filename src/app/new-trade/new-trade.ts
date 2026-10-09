import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  OnInit,
  Output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { TradeMode, TradeModeService } from '../trade-mode';
import { MistakePicker } from '../mistakes/mistakes';
import { TagPicker } from '../tags/tags';
import { EmotionPicker, ResultPicker } from '../trade-form-fields';
import { ImageGallery } from '../image-gallery/image-gallery';
import { TradeFormBase } from '../trade-form/trade-form-base';

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
  selector: 'app-new-trade',
  styleUrl: '../trade-form/trade-form.css',
  templateUrl: '../trade-form/trade-form.html',
})
export class NewTrade extends TradeFormBase implements OnInit {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  // saved: trade saved and the form should close
  // added: trade saved via "Save and add another"; the form stays open
  @Output() saved = new EventEmitter<void>();
  @Output() added = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly isEdit = false;
  // Starts on the app's current live/backtest mode
  override mode: TradeMode = inject(TradeModeService).mode();

  // Screenshots wait here until the trade exists, then upload
  private gallery = viewChild(ImageGallery);

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/rules`, this.authHeaders()).subscribe((response) => {
      this.allRules.set(response.rules);
      this.checkedRuleIds.set(new Set(response.rules.map((r: any) => r.id)));
    });
    this.loadLists();
    this.applyFeeDefault();
  }

  onSubmit(addAnother = false) {
    if (this.saving() || !this.validate()) return;
    this.saving.set(true);
    this.rememberFees();

    this.http
      .post<any>(`${environment.apiUrl}/trades`, this.payload(), this.authHeaders())
      .subscribe({
        next: (newTrade) => this.linkExtras(newTrade.id, () => this.finish(addAnother)),
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err.error?.error || 'Something went wrong saving the trade.');
        },
      });
  }

  // Rules, mistakes, tags, answers and screenshots are saved in parallel; done() runs once all finish
  private linkExtras(tradeId: number, done: () => void) {
    let pending = 5;
    const oneDone = () => {
      pending -= 1;
      if (pending === 0) done();
    };
    this.linkRules(tradeId, oneDone);
    this.putList(
      `trades/${tradeId}/mistakes`,
      { mistake_ids: [...this.selectedMistakeIds()] },
      oneDone,
    );
    this.putList(`trades/${tradeId}/tags`, { tag_ids: [...this.selectedTagIds()] }, oneDone);
    this.saveAnswers(tradeId, oneDone);
    this.uploadScreenshots(tradeId, oneDone);
  }

  // Mistakes and tags: nothing to send for an empty list on a new trade
  private putList(path: string, body: Record<string, number[]>, done: () => void) {
    if (Object.values(body)[0].length === 0) {
      done();
      return;
    }
    this.http
      .put(`${environment.apiUrl}/${path}`, body, this.authHeaders())
      .subscribe({ next: done, error: done });
  }

  private saveAnswers(tradeId: number, done: () => void) {
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
      this.http
        .post(
          `${environment.apiUrl}/trade-answers`,
          { trade_id: tradeId, question_id: questionId, choice, comment: null },
          this.authHeaders(),
        )
        .subscribe({ next: one, error: one });
    }
  }

  private uploadScreenshots(tradeId: number, done: () => void) {
    const gallery = this.gallery();
    if (!gallery || gallery.queued().length === 0) {
      done();
      return;
    }
    gallery
      .uploadQueued({
        base: `${environment.apiUrl}/trades/${tradeId}/images`,
        item: `${environment.apiUrl}/trade-images`,
      })
      .then((failed) => {
        if (failed > 0) {
          alert(
            `The trade was saved, but ${failed} screenshot${failed === 1 ? '' : 's'} didn't upload. ` +
              "You can add them from the trade's page.",
          );
          gallery.clearQueued();
        }
        done();
      });
  }

  private linkRules(tradeId: number, done: () => void) {
    const allRules = this.allRules();
    if (allRules.length === 0) {
      done();
      return;
    }
    let remaining = allRules.length;
    const one = () => {
      remaining -= 1;
      if (remaining === 0) done();
    };
    for (const rule of allRules) {
      this.http
        .post<any>(
          `${environment.apiUrl}/trade-rules`,
          { trade_id: tradeId, rule_id: rule.id, followed: this.checkedRuleIds().has(rule.id) },
          this.authHeaders(),
        )
        .subscribe({ next: one, error: one });
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

  // Keeps the setup that repeats across a session (date, symbol, setup, session,
  // direction, contracts, fees, mode) and clears the per-trade fields.
  resetForNextTrade() {
    this.entry_price = 0;
    this.exit_price = 0;
    this.entry_time = '';
    this.exit_time = '';
    this.emotions = [];
    this.grade = '';
    this.result = null;
    this.stop_price = null;
    this.target_price = null;
    this.gallery()?.clearQueued();
    this.notes = '';
    this.screenshot_link = '';
    this.answers.set(new Map());
    this.checkedRuleIds.set(new Set(this.allRules().map((r: any) => r.id)));
    this.selectedMistakeIds.set(new Set());
    const setupIds = new Set((this.setupGroup()?.tags ?? []).map((t) => t.id));
    this.selectedTagIds.update((ids) => new Set([...ids].filter((id) => setupIds.has(id))));
    this.goTo(0);
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
