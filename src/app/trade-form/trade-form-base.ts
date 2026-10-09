import { computed, Directive, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GRADES, SESSIONS, todayLocal, tradeDuration } from '../trade-journal';
import { TradeMode } from '../trade-mode';
import { Mistake } from '../mistakes/mistakes';
import { autoOutcome, estimateR, formatR, TradeOutcome } from '../outcome';
import { TagGroup } from '../tags/tags';
import { blankPrice, estimateNetPnl, POINT_VALUES, toggleEmotion } from '../trade-form-fields';
import { GalleryImage, ImageTarget } from '../image-gallery/image-gallery';
import {
  FORM_STEPS,
  qualityScore,
  rememberedFee,
  rememberFee,
  suggestSession,
} from './trade-form-logic';

export type AnswerChoice = 'yes' | 'no' | 'other';

// Everything the New and Edit trade forms share: the fields, the live
// calculations, the three steps and the shared template (trade-form.html).
@Directive()
export abstract class TradeFormBase {
  protected http = inject(HttpClient);

  abstract readonly isEdit: boolean;
  abstract onSubmit(addAnother?: boolean): void;
  abstract cancel(): void;

  // ---- fields ----
  mode: TradeMode = 'live';
  trade_date = todayLocal();
  symbol = 'MNQ';
  direction = 'long';
  contracts = 1;
  entry_price: number | string = 0;
  exit_price: number | string = 0;
  fees: number | string = 0;
  strategy = '';
  screenshot_link = '';
  notes = '';
  entry_time = '';
  exit_time = '';
  session = '';
  emotions: string[] = [];
  grade = '';
  result: TradeOutcome | null = null; // null = auto from the prices
  stop_price: number | string | null = null;
  target_price: number | string | null = null;

  readonly sessions = SESSIONS;
  readonly grades = GRADES;
  readonly formatR = formatR;

  errorMessage = signal('');
  saving = signal(false);
  loaded = signal(true);
  loggedCount = signal(0);

  allRules = signal<any[]>([]);
  checkedRuleIds = signal<Set<number>>(new Set());
  mistakes = signal<Mistake[]>([]);
  selectedMistakeIds = signal<Set<number>>(new Set());
  tagGroups = signal<TagGroup[]>([]);
  selectedTagIds = signal<Set<number>>(new Set());
  questions = signal<{ id: number; question_text: string }[]>([]);
  answers = signal<Map<number, AnswerChoice>>(new Map());

  // Screenshots: Edit uploads straight to the trade; New queues them until it's saved
  images = signal<GalleryImage[]>([]);
  imageTarget: ImageTarget | null = null;

  // ---- steps ----
  readonly steps = FORM_STEPS;
  step = signal(0);

  goTo(index: number) {
    this.step.set(Math.max(0, Math.min(this.steps.length - 1, index)));
  }

  // ---- fees: filled in from the fee per contract last used for the symbol ----
  feesAuto = false;
  feePerContract: number | null = null;

  protected applyFeeDefault() {
    this.feePerContract = rememberedFee(this.symbol);
    this.feesAuto = this.feePerContract !== null;
    this.updateAutoFees();
  }

  updateAutoFees() {
    if (this.feesAuto && this.feePerContract !== null) {
      this.fees = Math.round(this.feePerContract * Number(this.contracts) * 100) / 100;
    }
  }

  onFeesTyped() {
    this.feesAuto = false;
  }

  onSymbolChange() {
    if (!this.isEdit) this.applyFeeDefault();
  }

  stepContracts(delta: number) {
    this.contracts = Math.max(1, Number(this.contracts) + delta);
    this.updateAutoFees();
  }

  protected rememberFees() {
    rememberFee(this.symbol, Number(this.fees), Number(this.contracts));
  }

  // ---- session: suggested from the entry time until picked by hand ----
  sessionAuto = false;

  onEntryTimeChange() {
    const suggestion = suggestSession(this.entry_time);
    if (suggestion && (!this.session || this.sessionAuto)) {
      this.session = suggestion;
      this.sessionAuto = true;
    }
  }

  onSessionPicked() {
    this.sessionAuto = false;
  }

  // ---- live numbers ----
  get duration(): string | null {
    return tradeDuration(this.entry_time, this.exit_time);
  }

  get feesValue(): number {
    return Number(this.fees) || 0;
  }

  get grossPoints(): number {
    const diff = Number(this.exit_price) - Number(this.entry_price);
    return Math.round((this.direction === 'long' ? diff : -diff) * 100) / 100;
  }

  get grossEstimate(): number {
    const pv = POINT_VALUES[this.symbol] || 0;
    return Math.round(this.grossPoints * pv * Number(this.contracts) * 100) / 100;
  }

  get netPnlEstimate(): number {
    return estimateNetPnl({
      ...this,
      entry_price: Number(this.entry_price),
      exit_price: Number(this.exit_price),
      fees: Number(this.fees),
    });
  }

  get entryEqualsExit(): boolean {
    return Number(this.entry_price) === Number(this.exit_price);
  }

  get autoResult(): TradeOutcome {
    return autoOutcome(this.entry_price, this.exit_price, this.netPnlEstimate);
  }

  get shownResult(): TradeOutcome {
    return this.result ?? this.autoResult;
  }

  get rPreview() {
    return estimateR({
      direction: this.direction,
      entry_price: this.entry_price,
      exit_price: this.exit_price,
      stop_price: blankPrice(this.stop_price),
      target_price: blankPrice(this.target_price),
    });
  }

  get riskDollars(): number {
    const r = this.rPreview;
    return r ? r.riskPoints * (POINT_VALUES[this.symbol] || 0) * Number(this.contracts) : 0;
  }

  // Same check as the API, so the form explains it before saving
  get stopProblem(): string {
    const long = this.direction === 'long';
    const entry = Number(this.entry_price);
    const stop = blankPrice(this.stop_price);
    const target = blankPrice(this.target_price);
    if (stop !== null && (long ? stop >= entry : stop <= entry)) {
      return `The stop for a ${long ? 'long' : 'short'} goes ${long ? 'below' : 'above'} the entry.`;
    }
    if (target !== null && (long ? target <= entry : target >= entry)) {
      return `The target for a ${long ? 'long' : 'short'} goes ${long ? 'above' : 'below'} the entry.`;
    }
    return '';
  }

  // Points between the entry and another price, always positive
  gap(price: number | string | null): number | null {
    const p = blankPrice(price);
    return p === null ? null : Math.round(Math.abs(p - Number(this.entry_price)) * 100) / 100;
  }

  exitAt(which: 'target' | 'stop') {
    const price = blankPrice(which === 'target' ? this.target_price : this.stop_price);
    if (price !== null) this.exit_price = price;
  }

  // ---- tags: Setup sits in Essentials, the other groups in Execution ----
  readonly setupGroup = computed(
    () => this.tagGroups().find((g) => g.name.toLowerCase() === 'setup') ?? null,
  );
  readonly otherTagGroups = computed(() =>
    this.tagGroups().filter((g) => g.name.toLowerCase() !== 'setup'),
  );

  // ---- review ----
  answerOf(questionId: number): AnswerChoice | null {
    return this.answers().get(questionId) ?? null;
  }

  setAnswer(questionId: number, choice: AnswerChoice) {
    this.answers.update((current) => new Map(current).set(questionId, choice));
  }

  get score() {
    const answered = [...this.answers().values()];
    return qualityScore({
      rulesFollowed: this.checkedRuleIds().size,
      rulesTotal: this.allRules().length,
      mistakes: this.selectedMistakeIds().size,
      rMultiple: this.rPreview?.rMultiple ?? null,
      answersYes: answered.filter((a) => a === 'yes').length,
      answersTotal: answered.length,
      grade: this.grade,
    });
  }

  // ---- small setters used by the template ----
  setResult(value: TradeOutcome | null) {
    this.result = value;
  }

  toggleEmotion(emotion: string) {
    this.emotions = toggleEmotion(this.emotions, emotion);
  }

  private toggleIn(set: WritableSignal<Set<number>>, id: number) {
    set.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleTag(id: number) {
    this.toggleIn(this.selectedTagIds, id);
  }

  toggleMistake(id: number) {
    this.toggleIn(this.selectedMistakeIds, id);
  }

  toggleRule(id: number) {
    this.toggleIn(this.checkedRuleIds, id);
  }

  setDirection(value: string) {
    this.direction = value;
  }

  setMode(value: TradeMode) {
    this.mode = value;
  }

  setGrade(value: string) {
    this.grade = this.grade === value ? '' : value;
  }

  onImageAdded(image: GalleryImage) {
    this.images.update((list) => [...list, image]);
  }

  onImageRemoved(id: number) {
    this.images.update((list) => list.filter((i) => i.id !== id));
  }

  onCaptioned({ id, caption }: { id: number; caption: string | null }) {
    this.images.update((list) => list.map((i) => (i.id === id ? { ...i, caption } : i)));
  }

  // ---- shared loading and saving ----
  protected authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  protected loadLists() {
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`, this.authHeaders())
      .subscribe((response) => this.mistakes.set(response.mistakes));
    this.http
      .get<{ groups: TagGroup[] }>(`${environment.apiUrl}/tag-groups`, this.authHeaders())
      .subscribe((response) => this.tagGroups.set(response.groups));
    this.http
      .get<any>(`${environment.apiUrl}/questions`, this.authHeaders())
      .subscribe((response) => this.questions.set(response.questions));
  }

  // Checks before saving; sends the user to the step with the problem
  protected validate(): boolean {
    this.errorMessage.set('');
    if (!this.trade_date) {
      this.errorMessage.set('Please select a date.');
      this.goTo(0);
      return false;
    }
    if (this.stopProblem) {
      this.errorMessage.set(this.stopProblem);
      this.goTo(0);
      return false;
    }
    return true;
  }

  // With a Setup tag group, Strategy is the chosen setups (the trades list and
  // filters still read it); without one it's whatever was typed
  protected strategyForSave(): string {
    const setup = this.setupGroup();
    if (!setup) return this.strategy;
    const chosen = setup.tags.filter((t) => this.selectedTagIds().has(t.id)).map((t) => t.name);
    return chosen.length ? chosen.join(', ') : this.strategy;
  }

  protected payload() {
    return {
      trade_date: this.trade_date,
      symbol: this.symbol,
      direction: this.direction,
      contracts: this.contracts,
      entry_price: this.entry_price,
      exit_price: this.exit_price,
      fees: this.fees,
      strategy: this.strategyForSave(),
      screenshot_link: this.screenshot_link || null,
      notes: this.notes || null,
      entry_time: this.entry_time || null,
      exit_time: this.exit_time || null,
      session: this.session || null,
      emotions: this.emotions,
      grade: this.grade || null,
      result: this.result,
      stop_price: blankPrice(this.stop_price),
      target_price: blankPrice(this.target_price),
      mode: this.mode,
    };
  }
}
