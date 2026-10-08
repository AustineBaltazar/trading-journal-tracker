import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  compareMonths,
  currentMonth,
  monthKey,
  monthLabel,
  shiftMonth,
  YearMonth,
} from '../trade-journal';

const MIN_MONTH: YearMonth = { year: 2000, month: 0 };
const SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// ‹ Month Year › bar; clicking the label opens a year + month grid.
// Months after the current one can't be picked.
@Component({
  selector: 'app-month-picker',
  templateUrl: './month-picker.html',
})
export class MonthPicker {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  value = input.required<YearMonth>();
  // "YYYY-MM" keys of months that have trades; shown as a dot
  marked = input<Set<string>>(new Set());
  valueChange = output<YearMonth>();

  open = signal(false);
  panelYear = signal(0);

  readonly max = currentMonth();
  readonly label = computed(() => monthLabel(this.value()));
  readonly canGoBack = computed(() => compareMonths(this.value(), MIN_MONTH) > 0);
  readonly canGoForward = computed(() => compareMonths(this.value(), this.max) < 0);

  readonly months = computed(() => {
    const year = this.panelYear();
    const selected = this.value();
    return SHORT_NAMES.map((name, month) => {
      const ym = { year, month };
      return {
        name,
        month,
        selected: compareMonths(ym, selected) === 0,
        disabled: compareMonths(ym, this.max) > 0 || compareMonths(ym, MIN_MONTH) < 0,
        hasTrades: this.marked().has(monthKey(ym)),
      };
    });
  });

  step(delta: number) {
    const next = shiftMonth(this.value(), delta);
    if (compareMonths(next, MIN_MONTH) < 0 || compareMonths(next, this.max) > 0) return;
    this.valueChange.emit(next);
  }

  toggle() {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.panelYear.set(this.value().year);
    this.open.set(true);
  }

  changeYear(delta: number) {
    const year = this.panelYear() + delta;
    if (year < MIN_MONTH.year || year > this.max.year) return;
    this.panelYear.set(year);
  }

  pick(month: number) {
    const ym = { year: this.panelYear(), month };
    if (compareMonths(ym, this.max) > 0) return;
    this.valueChange.emit(ym);
    this.close();
  }

  thisMonth() {
    this.valueChange.emit(this.max);
    this.close();
  }

  // Focus goes back to the label only when closing from the keyboard (Esc)
  close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) {
      this.host.nativeElement.querySelector<HTMLButtonElement>('[data-month-label]')?.focus();
    }
  }

  // Arrow keys move between month buttons (3 per row)
  onGridKey(event: KeyboardEvent, month: number) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
    };
    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const target = Math.min(11, Math.max(0, month + delta));
    this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-month="${target}"]`)?.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close(true);
  }
}
