import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { environment } from '../../environments/environment';
import { Mistake } from '../mistakes/mistakes';
import { ModeBadge, TradeMode, TradeModeService } from '../trade-mode';
import { TagGroup } from '../tags/tags';
import { MONTH_NAMES, todayLocal } from '../trade-journal';
import {
  DateRange,
  isRangeKey,
  RangeKey,
  rangeDates,
  tradesInRange,
} from '../reports/report-logic';
import {
  buildPatterns,
  buildRecords,
  Pattern,
  PATTERN_GROUPS,
  PatternGroup,
} from './insights-logic';

// "top" = the 3 biggest leaks and edges; "all" = every pattern; or one group
export type InsightFilter = 'top' | 'all' | PatternGroup;
const TOP_COUNT = 3;

const RANGE_KEY = 'insightsRange';
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'all', label: 'All time' },
];

function storedRange(): RangeKey {
  try {
    const value = localStorage.getItem(RANGE_KEY);
    return isRangeKey(value) && value !== 'custom' ? value : 'all';
  } catch {
    return 'all';
  }
}

const ICONS: Record<Pattern['icon'], string> = {
  pink: 'bg-gradient-to-br from-purple-500 to-pink-500',
  blue: 'bg-gradient-to-br from-blue-500 to-indigo-500',
  orange: 'bg-gradient-to-br from-amber-500 to-red-500',
  green: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  slate: 'bg-gradient-to-br from-slate-600 to-slate-500',
  cyan: 'bg-gradient-to-br from-cyan-500 to-blue-500',
};

// Patterns found in your own trades: what costs you money, what makes it,
// and your streaks and records. Plain math, no AI.
@Component({
  selector: 'app-insights',
  imports: [ModeBadge, NgTemplateOutlet],
  templateUrl: './insights.html',
})
export class Insights {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly tradeMode = inject(TradeModeService);
  readonly ranges = RANGES;

  range = signal<RangeKey>(storedRange());
  trades = signal<any[]>([]);
  loaded = signal(false);
  mistakes = signal<Mistake[]>([]);
  tagGroups = signal<TagGroup[]>([]);
  rules = signal<any>(null);

  readonly dates = computed(() => rangeDates(this.range(), todayLocal()));
  readonly rangeTrades = computed(() => tradesInRange(this.trades(), this.dates()));
  readonly patterns = computed(() =>
    buildPatterns({
      trades: this.rangeTrades(),
      mistakes: this.mistakes(),
      tagGroups: this.tagGroups(),
      rules: this.rules(),
    }),
  );
  readonly records = computed(() => buildRecords(this.rangeTrades()));

  filter = signal<InsightFilter>('top');
  // Chips with how many patterns each would show (leaks + edges)
  readonly chips = computed(() => {
    const { leaks, edges } = this.patterns();
    const all = [...leaks, ...edges];
    return [
      { key: 'top' as InsightFilter, label: 'Top', count: Math.min(all.length, TOP_COUNT * 2) },
      { key: 'all' as InsightFilter, label: 'All', count: all.length },
      ...PATTERN_GROUPS.map((g) => ({
        key: g.key as InsightFilter,
        label: g.label,
        count: all.filter((p) => p.group === g.key).length,
      })),
    ];
  });
  readonly shown = computed(() => {
    const { leaks, edges } = this.patterns();
    const f = this.filter();
    if (f === 'top') return { leaks: leaks.slice(0, TOP_COUNT), edges: edges.slice(0, TOP_COUNT) };
    if (f === 'all') return { leaks, edges };
    return { leaks: leaks.filter((p) => p.group === f), edges: edges.filter((p) => p.group === f) };
  });
  // "3 of 15 · costing you money"
  readonly leakNote = computed(() =>
    this.note(this.shown().leaks.length, this.patterns().leaks.length, 'costing you money'),
  );
  readonly edgeNote = computed(() =>
    this.note(this.shown().edges.length, this.patterns().edges.length, 'keep doing these'),
  );

  private note(shown: number, total: number, words: string) {
    return shown < total ? `${shown} of ${total} · ${words}` : words;
  }

  setFilter(f: InsightFilter) {
    this.filter.set(f);
  }

  constructor() {
    effect(() => this.loadTrades(this.tradeMode.mode()));
    effect(() => this.loadRules(this.tradeMode.mode(), this.dates()));
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`)
      .subscribe((r) => this.mistakes.set(r.mistakes));
    this.http
      .get<{ groups: TagGroup[] }>(`${environment.apiUrl}/tag-groups`)
      .subscribe((r) => this.tagGroups.set(r.groups));
  }

  private loadTrades(mode: TradeMode) {
    this.loaded.set(false);
    this.http.get<any>(`${environment.apiUrl}/trades`, { params: { mode } }).subscribe((r) => {
      if (this.tradeMode.mode() !== mode) return;
      this.trades.set(r.trades);
      this.loaded.set(true);
    });
  }

  private loadRules(mode: TradeMode, dates: DateRange) {
    const params: Record<string, string> = { mode };
    if (dates.from) params['from'] = dates.from;
    if (dates.to) params['to'] = dates.to;
    this.http.get<any>(`${environment.apiUrl}/rule-adherence`, { params }).subscribe((r) => {
      const now = this.dates();
      if (this.tradeMode.mode() === mode && now.from === dates.from && now.to === dates.to)
        this.rules.set(r);
    });
  }

  setRange(range: RangeKey) {
    this.range.set(range);
    try {
      localStorage.setItem(RANGE_KEY, range);
    } catch {
      // only a convenience
    }
  }

  iconClass(icon: Pattern['icon']) {
    return ICONS[icon];
  }

  // The Reports tab behind a pattern, same date range
  open(p: Pattern) {
    if (p.tab)
      this.router.navigate(['/reports'], { queryParams: { tab: p.tab, range: this.range() } });
  }

  money(n: number) {
    const abs = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}${abs}`;
  }

  // "Sep 15 – 23", "Aug 30 – Sep 2", "Sep 3"
  span(from: string | null, to: string | null) {
    if (!from) return '';
    const fmt = (d: string) =>
      `${MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)} ${Number(d.slice(8, 10))}`;
    if (!to || to === from) return fmt(from);
    return from.slice(0, 7) === to.slice(0, 7)
      ? `${fmt(from)} – ${Number(to.slice(8, 10))}`
      : `${fmt(from)} – ${fmt(to)}`;
  }

  monthName(ym: string) {
    return `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  }
}
