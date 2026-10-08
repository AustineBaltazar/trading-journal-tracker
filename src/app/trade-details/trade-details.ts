import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EditTrade } from '../edit-trade/edit-trade';
import { environment } from '../../environments/environment';
import { tradeDuration } from '../trade-journal';
import { emotionsOf, outcomeOf } from '../outcome';
import { GalleryImage, ImageGallery, ImageTarget } from '../image-gallery/image-gallery';

interface DraftAnswer {
  choice: string;
  comment: string;
}

@Component({
  imports: [FormsModule, RouterLink, DecimalPipe, SlicePipe, EditTrade, ImageGallery],
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
  allMistakes = signal<{ id: number; name: string }[]>([]);
  // Names of this trade's mistakes, in the order of the user's list
  mistakeNames = computed(() => {
    const ids = new Set<number>(this.trade()?.mistakeIds || []);
    return this.allMistakes()
      .filter((m) => ids.has(m.id))
      .map((m) => m.name);
  });
  duration = computed(() => tradeDuration(this.trade()?.entry_time, this.trade()?.exit_time));
  outcome = computed(() => (this.trade() ? outcomeOf(this.trade()) : null));
  emotions = computed(() => (this.trade() ? emotionsOf(this.trade()) : []));
  readonly outcomeLabel = { win: 'Win', loss: 'Loss', be: 'BE' } as const;
  imageTarget = computed<ImageTarget>(() => ({
    base: `${environment.apiUrl}/trades/${this.tradeId}/images`,
    item: `${environment.apiUrl}/trade-images`,
  }));
  allRules = signal<any[]>([]);
  linkedRules = signal<any[]>([]);
  allQuestions = signal<any[]>([]);
  answers = signal<any[]>([]);

  draftAnswers = signal<Map<number, DraftAnswer>>(new Map());
  saveStatus = signal<'idle' | 'saving' | 'success' | 'error'>('idle');

  showEditModal = signal(false);
  showDeleteConfirm = signal(false);

  ngOnInit() {
    this.tradeId = this.route.snapshot.paramMap.get('id')!;
    this.loadTrade();
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`, this.authHeaders())
      .subscribe((response) => this.allMistakes.set(response.mistakes));
    this.loadRules();
    this.loadQuestions();
  }

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  onImageAdded(image: GalleryImage) {
    this.trade.update((t) => ({ ...t, images: [...(t.images || []), image] }));
  }

  onImageRemoved(id: number) {
    this.trade.update((t) => ({ ...t, images: t.images.filter((i: GalleryImage) => i.id !== id) }));
  }

  onCaptioned({ id, caption }: { id: number; caption: string | null }) {
    this.trade.update((t) => ({
      ...t,
      images: t.images.map((i: GalleryImage) => (i.id === id ? { ...i, caption } : i)),
    }));
  }

  loadTrade() {
    this.http
      .get<any>(`${environment.apiUrl}/trades/${this.tradeId}`, this.authHeaders())
      .subscribe((trade) => this.trade.set(trade));
  }

  loadRules() {
    this.http
      .get<any>(`${environment.apiUrl}/rules`, this.authHeaders())
      .subscribe((response) => this.allRules.set(response.rules));

    this.http
      .get<any>(`${environment.apiUrl}/trades/${this.tradeId}/rules`, this.authHeaders())
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
      .get<any>(`${environment.apiUrl}/questions`, this.authHeaders())
      .subscribe((response) => this.allQuestions.set(response.questions));

    this.http
      .get<any>(`${environment.apiUrl}/trades/${this.tradeId}/answers`, this.authHeaders())
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
            `${environment.apiUrl}/trades/${this.tradeId}/answers/${questionId}`,
            { choice: draft.choice, comment: draft.comment },
            this.authHeaders(),
          )
        : this.http.post<any>(
            `${environment.apiUrl}/trade-answers`,
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

  openEdit() {
    this.showEditModal.set(true);
  }

  closeEdit() {
    this.showEditModal.set(false);
  }

  onEditSaved() {
    this.showEditModal.set(false);
    this.loadTrade();
    this.loadRules();
  }

  openDeleteConfirm() {
    this.showDeleteConfirm.set(true);
  }

  closeDeleteConfirm() {
    this.showDeleteConfirm.set(false);
  }

  confirmDelete() {
    this.http
      .delete<any>(`${environment.apiUrl}/trades/${this.tradeId}`, this.authHeaders())
      .subscribe(() => this.router.navigate(['/trades']));
  }

  pointDifference(): number {
    const t = this.trade();
    if (!t) return 0;
    const diff =
      t.direction === 'long' ? t.exit_price - t.entry_price : t.entry_price - t.exit_price;
    return Math.round(diff * 100) / 100;
  }

  pointValue(): number {
    const t = this.trade();
    if (!t) return 0;
    const values: Record<string, number> = { MNQ: 2, NQ: 20 };
    return values[t.symbol] || 0;
  }
}
