import { Component, input, output } from '@angular/core';

export interface Mistake {
  id: number;
  name: string;
  count?: number; // trades in the current mode using it (from GET /mistakes)
}

export interface MistakeRow {
  id: number;
  name: string;
  count: number;
  winRate: number;
  net: number;
}

export interface MistakeCost {
  total: { count: number; net: number };
  clean: { count: number; net: number; winRate: number };
  withMistakes: { count: number; net: number; winRate: number };
  rows: MistakeRow[]; // only mistakes that happened, most expensive first
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const winRate = (trades: { netPnl: number }[]) =>
  trades.length ? Math.round((trades.filter((t) => t.netPnl > 0).length / trades.length) * 100) : 0;
const net = (trades: { netPnl: number }[]) => round2(trades.reduce((s, t) => s + t.netPnl, 0));

// "Cost of mistakes": clean trades vs trades with a mistake, and each mistake's
// P/L. A trade with two mistakes counts in both rows.
export function buildMistakeCost(
  trades: { netPnl: number; mistakeIds?: number[] }[],
  mistakes: Mistake[],
): MistakeCost {
  const clean = trades.filter((t) => !t.mistakeIds?.length);
  const flawed = trades.filter((t) => t.mistakeIds?.length);
  const rows = mistakes
    .map((m) => {
      const tagged = flawed.filter((t) => t.mistakeIds!.includes(m.id));
      return {
        id: m.id,
        name: m.name,
        count: tagged.length,
        winRate: winRate(tagged),
        net: net(tagged),
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => a.net - b.net || b.count - a.count);

  return {
    total: { count: trades.length, net: net(trades) },
    clean: { count: clean.length, net: net(clean), winRate: winRate(clean) },
    withMistakes: { count: flawed.length, net: net(flawed), winRate: winRate(flawed) },
    rows,
  };
}

// Row of toggleable mistake chips for the trade forms. None selected = clean trade.
@Component({
  selector: 'app-mistake-picker',
  template: `
    <div class="flex items-baseline justify-between mb-2">
      <span class="text-xs font-medium text-slate-300">Mistakes</span>
      <span class="text-[10px] text-slate-500">tap any that apply · none = clean trade</span>
    </div>
    @if (options().length === 0) {
      <p class="text-xs text-slate-500">Add mistakes in the Playbook to tag them here.</p>
    } @else {
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Mistakes">
        @for (m of options(); track m.id) {
          <button
            type="button"
            [attr.aria-pressed]="selected().has(m.id)"
            (click)="toggle.emit(m.id)"
            class="text-xs px-3 py-1 rounded-full border transition-colors"
            [class]="
              selected().has(m.id)
                ? 'border-rose-500/55 bg-rose-500/12 text-rose-100'
                : 'border-[#26354f] bg-[#121a2a] text-slate-300 hover:border-slate-500'
            "
          >
            {{ selected().has(m.id) ? '✓ ' : '' }}{{ m.name }}
          </button>
        }
      </div>
      <p
        class="text-xs mt-2"
        [class.text-emerald-400]="selected().size === 0"
        [class.text-rose-300]="selected().size > 0"
      >
        @if (selected().size === 0) {
          ✓ Clean trade, no mistakes
        } @else {
          {{ selected().size }} {{ selected().size === 1 ? 'mistake' : 'mistakes' }} tagged
        }
      </p>
    }
  `,
})
export class MistakePicker {
  options = input<Mistake[]>([]);
  selected = input<Set<number>>(new Set());
  toggle = output<number>();
}
