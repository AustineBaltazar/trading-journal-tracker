import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import {
  buildEdgeAnalytics,
  formatMinutes,
  MIN_SAMPLE,
  winRateTier,
} from '../dashboard/edge-analytics';
import { buildMistakeCost, Mistake } from '../mistakes/mistakes';
import { ModeBadge, TradeMode, TradeModeService } from '../trade-mode';
import { countOutcomes, formatR } from '../outcome';
import { TagGroup } from '../tags/tags';
import { todayLocal } from '../trade-journal';
import {
  buildDayOfWeek,
  buildRStats,
  buildTagReport,
  DateRange,
  isRangeKey,
  RANGE_OPTIONS,
  rangeDates,
  RangeKey,
  REPORT_TABS,
  ReportTab,
  tradesInRange,
} from './report-logic';
import { buildFindings, tagExtremes } from './overview';
import { MistakeRow } from '../mistakes/mistakes';

const RANGE_STORAGE_KEY = 'reportsRange';

function storedRange(): RangeKey {
  try {
    const value = localStorage.getItem(RANGE_STORAGE_KEY);
    return isRangeKey(value) ? value : 'all';
  } catch {
    return 'all';
  }
}

// Analysis that used to sit at the bottom of the dashboard, with one date range
// for every section. Tab and range live in the URL so links can open a section.
@Component({
  imports: [DecimalPipe, ModeBadge],
  selector: 'app-reports',
  templateUrl: './reports.html',
})
export class Reports {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly tradeMode = inject(TradeModeService);

  readonly rangeOptions = RANGE_OPTIONS;
  readonly tabs: { key: ReportTab; label: string; question: string }[] = [
    { key: 'all', label: 'All', question: 'Every report on one page' },
    { key: 'timing', label: 'Timing', question: 'When you trade best' },
    {
      key: 'psychology',
      label: 'Psychology',
      question: 'How your state of mind shows up in results',
    },
    {
      key: 'discipline',
      label: 'Discipline',
      question: 'What your mistakes and rules cost or earn',
    },
    { key: 'tags', label: 'Tags', question: 'Results by setup, news and market' },
  ];

  tab = signal<ReportTab>('all');

  // "All" is an overview; each section's full detail is on its own tab
  show(section: ReportTab) {
    return this.tab() === section;
  }

  sectionTab(section: ReportTab) {
    return this.tabs.find((t) => t.key === section)!;
  }
  range = signal<RangeKey>(storedRange());
  custom = signal<DateRange>({ from: null, to: null });

  trades = signal<any[]>([]);
  loaded = signal(false);
  mistakes = signal<Mistake[]>([]);
  ruleStats = signal<any>(null);
  tagGroups = signal<TagGroup[]>([]);

  readonly dates = computed(() => rangeDates(this.range(), todayLocal(), this.custom()));
  readonly rangeTrades = computed(() => tradesInRange(this.trades(), this.dates()));

  // The line under the filter: what the numbers below are made of
  readonly scope = computed(() => {
    const trades = this.rangeTrades();
    const dates = trades.map((t) => t.trade_date.slice(0, 10)).sort();
    const net = Math.round(trades.reduce((s, t) => s + t.netPnl, 0) * 100) / 100;
    return {
      count: trades.length,
      first: dates[0],
      last: dates[dates.length - 1],
      net,
      ...countOutcomes(trades),
    };
  });

  readonly byDay = computed(() => buildDayOfWeek(this.rangeTrades()));
  readonly edge = computed(() => buildEdgeAnalytics(this.rangeTrades()));
  readonly gradeMax = computed(() => Math.max(1, ...this.edge().grades.map((g) => g.total)));
  readonly mistakeCost = computed(() => buildMistakeCost(this.rangeTrades(), this.mistakes()));
  readonly rStats = computed(() => buildRStats(this.rangeTrades()));
  readonly rBucketMax = computed(() => Math.max(1, ...this.rStats().buckets.map((b) => b.count)));
  readonly tagReport = computed(() => buildTagReport(this.rangeTrades(), this.tagGroups()));
  readonly formatR = formatR;
  readonly Math = Math;

  // ---- the "All" overview ----
  readonly findings = computed(() =>
    buildFindings({
      days: this.byDay(),
      edge: this.edge(),
      tags: this.tagReport(),
      mistakes: this.mistakeCost(),
    }),
  );
  readonly tagRows = computed(() => tagExtremes(this.tagReport()));
  // Emotions by net P/L: all of them, or the best 3 and worst 2 when there are more
  readonly emotionRows = computed(() => {
    const rows = [...this.edge().emotions].sort((a, b) => b.net - a.net);
    return rows.length <= 5 ? rows : [...rows.slice(0, 3), ...rows.slice(-2)];
  });
  private readonly dayMax = computed(() =>
    Math.max(1, ...this.byDay().map((d) => Math.abs(d.net))),
  );

  dayBarHeight(net: number) {
    return Math.max(6, Math.round((Math.abs(net) / this.dayMax()) * 100));
  }

  // Net P/L of the mistakes past the first three
  restNet(rows: MistakeRow[]) {
    return Math.round(rows.slice(3).reduce((s, r) => s + r.net, 0) * 100) / 100;
  }

  // "+$1,234.50" / "−$56.00"
  money(n: number) {
    const abs = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}$${abs}`;
  }

  signClass(n: number) {
    return n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-300';
  }

  // "Past −1R" → "<−1", "+2.5R+" → "2.5+"
  shortBucket(label: string) {
    return label.replace('Past ', '<').replace('+2.5R+', '2.5+').replace('R', '');
  }

  readonly minSample = MIN_SAMPLE;
  readonly winRateTier = winRateTier;
  readonly formatMinutes = formatMinutes;
  readonly tierBar = {
    high: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    mid: 'bg-blue-500',
    low: 'bg-rose-500',
  };
  readonly tierColumn = {
    high: 'bg-gradient-to-t from-emerald-600 to-teal-400',
    mid: 'bg-blue-500/80',
    low: 'bg-rose-500/80',
  };
  readonly tierTile = {
    high: 'bg-emerald-500/15 border-emerald-500/45 text-emerald-400',
    mid: 'bg-blue-500/15 border-blue-500/45 text-blue-300',
    low: 'bg-rose-500/15 border-rose-500/45 text-rose-400',
  };

  constructor() {
    const query = inject(ActivatedRoute).snapshot.queryParamMap;
    const tab = query.get('tab');
    if (REPORT_TABS.includes(tab as ReportTab)) this.tab.set(tab as ReportTab);
    const range = query.get('range');
    if (isRangeKey(range)) this.range.set(range);
    if (this.range() === 'custom')
      this.custom.set({ from: query.get('from'), to: query.get('to') });

    effect(() => this.loadTrades(this.tradeMode.mode()));
    effect(() => this.loadRules(this.tradeMode.mode(), this.dates()));
    this.http
      .get<any>(`${environment.apiUrl}/mistakes`)
      .subscribe((response) => this.mistakes.set(response.mistakes));
    this.http
      .get<{ groups: TagGroup[] }>(`${environment.apiUrl}/tag-groups`)
      .subscribe((response) => this.tagGroups.set(response.groups));
  }

  private loadTrades(mode: TradeMode) {
    this.loaded.set(false);
    this.http
      .get<any>(`${environment.apiUrl}/trades`, { params: { mode } })
      .subscribe((response) => {
        // ignore a response for a mode the user has already switched away from
        if (this.tradeMode.mode() !== mode) return;
        this.trades.set(response.trades);
        this.loaded.set(true);
      });
  }

  // Rule stats come from the API, so they're asked for with the same range
  private loadRules(mode: TradeMode, dates: DateRange) {
    const params: Record<string, string> = { mode };
    if (dates.from) params['from'] = dates.from;
    if (dates.to) params['to'] = dates.to;
    this.http.get<any>(`${environment.apiUrl}/rule-adherence`, { params }).subscribe((response) => {
      const current = this.dates();
      if (this.tradeMode.mode() !== mode || current.from !== dates.from || current.to !== dates.to)
        return;
      this.ruleStats.set(response);
    });
  }

  setTab(tab: ReportTab) {
    this.tab.set(tab);
    this.syncUrl();
  }

  setRange(range: RangeKey) {
    if (range === 'custom' && !this.custom().from && !this.custom().to) {
      // Start a custom range from what was showing, so the page doesn't jump
      this.custom.set(
        this.range() === 'all'
          ? { from: this.scope().first ?? null, to: this.scope().last ?? null }
          : this.dates(),
      );
    }
    this.range.set(range);
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, range);
    } catch {
      // remembering the range is only a convenience
    }
    this.syncUrl();
  }

  setCustom(edge: 'from' | 'to', value: string) {
    this.custom.update((c) => ({ ...c, [edge]: value || null }));
    this.syncUrl();
  }

  private syncUrl() {
    const custom = this.range() === 'custom';
    this.router.navigate([], {
      queryParams: {
        tab: this.tab(),
        range: this.range(),
        from: custom ? this.custom().from : null,
        to: custom ? this.custom().to : null,
      },
      replaceUrl: true,
    });
  }

  // Bar width for a row: share of the most expensive mistake's loss
  costBarWidth(net: number): number {
    const worst = Math.min(0, ...this.mistakeCost().rows.map((r) => r.net));
    return net < 0 && worst < 0 ? Math.round((net / worst) * 100) : 0;
  }

  formatDate(date: string | undefined): string {
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    const month = [
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
    ][m - 1];
    return `${month} ${d}, ${y}`;
  }

  absValue(n: number) {
    return Math.abs(n);
  }
}
