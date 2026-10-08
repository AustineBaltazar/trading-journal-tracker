import { Component, Injectable, computed, inject, signal } from '@angular/core';

export type TradeMode = 'live' | 'backtest';

const STORAGE_KEY = 'tradeMode';

function readStoredMode(): TradeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'backtest' ? 'backtest' : 'live';
  } catch {
    return 'live';
  }
}

// Which trades the app is showing: the real account or backtests. Pages read
// mode() and reload when it changes; the choice is remembered per browser.
@Injectable({ providedIn: 'root' })
export class TradeModeService {
  readonly mode = signal<TradeMode>(readStoredMode());
  readonly isBacktest = computed(() => this.mode() === 'backtest');

  set(mode: TradeMode) {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // storage blocked (private window): the choice just isn't remembered
    }
  }
}

// Purple "BACKTEST" pill shown next to page titles while backtest mode is on.
@Component({
  selector: 'app-mode-badge',
  template: `
    @if (tradeMode.isBacktest()) {
      <span
        class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-widest text-violet-300 bg-violet-500/15 border border-violet-500/45 align-middle"
        >BACKTEST</span
      >
    }
  `,
})
export class ModeBadge {
  readonly tradeMode = inject(TradeModeService);
}
