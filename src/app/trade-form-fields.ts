import { Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RESULT_OPTIONS, TradeOutcome } from './outcome';
import { EMOTIONS } from './trade-journal';

export const POINT_VALUES: Record<string, number> = { MNQ: 2, NQ: 20 };

// A price input's value as a number, or null when it's empty
export function blankPrice(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
const BAD_EMOTIONS = new Set(['FOMO', 'Revenge']);

// Net P/L while the form is being filled in, same math as the API's utils/pnl.js
export function estimateNetPnl(t: {
  symbol: string;
  direction: string;
  contracts: number;
  entry_price: number;
  exit_price: number;
  fees: number;
}): number {
  const entry = Number(t.entry_price);
  const exit = Number(t.exit_price);
  const diff = t.direction === 'long' ? exit - entry : entry - exit;
  const net = diff * (POINT_VALUES[t.symbol] || 0) * Number(t.contracts) - Number(t.fees || 0);
  return Math.round(net * 100) / 100;
}

// Win / Loss / BE. Shows what the prices say until the trader picks one;
// picking the highlighted auto choice keeps it on auto.
@Component({
  selector: 'app-result-picker',
  host: { class: 'block' },
  imports: [DecimalPipe],
  template: `
    <div class="flex items-baseline justify-between mb-1.5">
      <span class="text-xs font-medium text-slate-300">Result</span>
      <span class="text-[10px] text-slate-500">filled in from your prices · tap to change</span>
    </div>
    <div
      role="radiogroup"
      aria-label="Result"
      class="grid grid-cols-3 gap-1 p-1 bg-[#141c2c] border border-[#24334d] rounded-xl text-xs font-semibold"
    >
      @for (option of options; track option.value) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="shown() === option.value"
          (click)="pick(option.value)"
          class="py-1.5 rounded-lg border transition-colors"
          [class]="shown() === option.value ? onClass[option.value] : offClass"
        >
          {{ option.label }}
        </button>
      }
    </div>
    <p class="text-[11px] text-slate-400 mt-1.5">
      @if (result() === null) {
        <span class="text-slate-100 font-semibold">Auto-detected: {{ label(auto()) }}</span
        >.
        @if (auto() === 'be' && entryEqualsExit()) {
          Exit equals entry, so it's a break-even{{
            netPnl() < 0 ? ' even though fees make it −$' + (-netPnl() | number: '1.2-2') : ''
          }}.
        }
        Tap another to change it.
      } @else {
        <span class="text-slate-100 font-semibold">Set to {{ label(result()!) }}</span
        >.
        @if (result() !== auto()) {
          The prices say {{ label(auto()) }}.
        }
        <button
          type="button"
          (click)="changed.emit(null)"
          class="text-blue-300 hover:text-blue-200 underline underline-offset-2"
        >
          Use auto
        </button>
      }
    </p>
  `,
})
export class ResultPicker {
  result = input<TradeOutcome | null>(null);
  auto = input.required<TradeOutcome>();
  netPnl = input(0);
  entryEqualsExit = input(false);
  changed = output<TradeOutcome | null>();

  readonly options = RESULT_OPTIONS;
  readonly shown = computed(() => this.result() ?? this.auto());
  readonly offClass = 'border-transparent text-slate-400 hover:text-slate-200';
  readonly onClass: Record<TradeOutcome, string> = {
    win: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45',
    loss: 'bg-rose-500/15 text-rose-300 border-rose-500/45',
    be: 'bg-slate-400/15 text-slate-100 border-slate-400/55',
  };

  label(value: TradeOutcome) {
    return RESULT_OPTIONS.find((o) => o.value === value)!.label;
  }

  pick(value: TradeOutcome) {
    // Tapping what auto already shows stays on auto, so later price edits still update it
    this.changed.emit(this.result() === null && value === this.auto() ? null : value);
  }
}

// Emotion chips: pick all that apply. FOMO and Revenge show red, like on the trades list.
@Component({
  selector: 'app-emotion-picker',
  host: { class: 'block' },
  template: `
    <div class="flex items-baseline justify-between mb-1.5">
      <span class="text-xs font-medium text-slate-300">Emotions</span>
      <span class="text-[10px] text-slate-500">pick all that apply</span>
    </div>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Emotions">
      @for (emotion of emotions; track emotion) {
        @let on = selected().includes(emotion);
        <button
          type="button"
          [attr.aria-pressed]="on"
          (click)="toggle.emit(emotion)"
          class="text-xs px-3 py-1 rounded-full border transition-colors"
          [class]="
            !on
              ? 'border-[#26354f] bg-[#121a2a] text-slate-300 hover:border-slate-500'
              : bad.has(emotion)
                ? 'border-rose-500/55 bg-rose-500/12 text-rose-100'
                : 'border-blue-400/55 bg-blue-600/15 text-blue-100'
          "
        >
          {{ emotion }}
        </button>
      }
    </div>
  `,
})
export class EmotionPicker {
  selected = input<string[]>([]);
  toggle = output<string>();

  readonly emotions = EMOTIONS;
  readonly bad = BAD_EMOTIONS;
}

// Adds or removes an emotion, keeping the list in the standard order
export function toggleEmotion(list: string[], emotion: string): string[] {
  const next = new Set(list);
  if (next.has(emotion)) next.delete(emotion);
  else next.add(emotion);
  return EMOTIONS.filter((e) => next.has(e));
}
