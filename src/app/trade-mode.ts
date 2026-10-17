import { Component, Injectable, computed, inject, signal } from '@angular/core';

export type TradeMode = 'live' | 'eval' | 'backtest';
export const TRADE_MODES: TradeMode[] = ['live', 'eval', 'backtest'];

const STORAGE_KEY = 'tradeMode';

// Off for now: the app is one live journal. Backtest and eval trades stay in the
// database; set this back to true to bring the Live / Eval / Backtest switch back.
export const MODE_SWITCH = false;

function readStoredMode(): TradeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as TradeMode;
    return TRADE_MODES.includes(stored) ? stored : 'live';
  } catch {
    return 'live';
  }
}

// A mode from the API, or live when it's missing or unknown
export function asMode(value: unknown): TradeMode {
  return TRADE_MODES.includes(value as TradeMode) ? (value as TradeMode) : 'live';
}

export const MODE_LABELS: Record<TradeMode, string> = {
  live: 'Live',
  eval: 'Eval',
  backtest: 'Backtest',
};

// Which trades the app is showing: the real account, a prop-firm evaluation, or backtests. Pages read
// mode() and reload when it changes; the choice is remembered per browser.
@Injectable({ providedIn: 'root' })
export class TradeModeService {
  readonly mode = signal<TradeMode>(MODE_SWITCH ? readStoredMode() : 'live');
  readonly isBacktest = computed(() => this.mode() === 'backtest');
  readonly isEval = computed(() => this.mode() === 'eval');
  // "New trade", "New eval trade", "New backtest trade"
  readonly newTradeLabel = computed(() =>
    this.isBacktest() ? 'New backtest trade' : this.isEval() ? 'New eval trade' : 'New trade',
  );

  set(mode: TradeMode) {
    if (!MODE_SWITCH) return;
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // storage blocked (private window): the choice just isn't remembered
    }
  }
}

// "EVAL" (amber) or "BACKTEST" (purple) pill next to page titles in those modes.
@Component({
  selector: 'app-mode-badge',
  template: `
    @if (tradeMode.isBacktest()) {
      <span
        class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-widest text-violet-300 bg-violet-500/15 border border-violet-500/45 align-middle"
        >BACKTEST</span
      >
    } @else if (tradeMode.isEval()) {
      <span
        class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-widest text-amber-300 bg-amber-500/15 border border-amber-500/45 align-middle"
        >EVAL</span
      >
    }
  `,
})
export class ModeBadge {
  readonly tradeMode = inject(TradeModeService);
}
