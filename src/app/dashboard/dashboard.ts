import { Component, effect, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { buildEdgeAnalytics, formatMinutes, MIN_SAMPLE, winRateTier } from './edge-analytics';
import { buildEquityChart, CHART, CHART_HEIGHT } from './equity-chart';
import { buildCalendarMonth, dayStyle } from './calendar';
import { MonthPicker } from '../month-picker/month-picker';
import { ModeBadge, TradeMode, TradeModeService } from '../trade-mode';
import {
  currentMonth,
  monthLabel as formatMonth,
  monthsWithTrades,
  todayLocal,
  tradesInMonth,
  YearMonth,
} from '../trade-journal';

@Component({
  imports: [RouterLink, DecimalPipe, UpperCasePipe, MonthPicker, ModeBadge],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly tradeMode = inject(TradeModeService);
  summary = signal<any>(null);
  trades = signal<any[]>([]);
  ruleAdherence = signal<any[]>([]);
  ruleStats = signal<any>(null);

  calendarMonth = signal<YearMonth>(currentMonth());
  monthLabel = computed(() => formatMonth(this.calendarMonth()));
  tradeMonths = computed(() => monthsWithTrades(this.trades()));

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  // Loads on start and again whenever the live/backtest switch changes
  constructor() {
    effect(() => this.load(this.tradeMode.mode()));
  }

  private load(mode: TradeMode) {
    // Ignore responses that arrive after the user has already switched modes
    const current = () => this.tradeMode.mode() === mode;
    const params = { mode };
    this.summary.set(null);

    this.http
      .get<any>(`${environment.apiUrl}/trades/summary`, { ...this.authHeaders(), params })
      .subscribe((response) => current() && this.summary.set(response));

    this.http
      .get<any>(`${environment.apiUrl}/trades`, { ...this.authHeaders(), params })
      .subscribe((response) => current() && this.trades.set(response.trades));

    this.http
      .get<any>(`${environment.apiUrl}/rule-adherence`, { ...this.authHeaders(), params })
      .subscribe((response) => {
        if (!current()) return;
        this.ruleAdherence.set(response.adherence);
        this.ruleStats.set(response);
      });
  }

  dailyPnl = computed(() => {
    const map = new Map<string, number>();
    for (const trade of this.trades()) {
      const date = trade.trade_date.substring(0, 10);
      map.set(date, (map.get(date) || 0) + trade.netPnl);
    }
    return map;
  });

  kpiStats = computed(() => {
    const trades = this.trades();
    const total = trades.length;
    const grossWin = trades.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
    const grossLoss = Math.abs(
      trades.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0),
    );
    const profitFactor = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : 0;
    const tradingDays = this.dailyPnl().size;
    const avgPerTrade =
      total > 0 ? Math.round((trades.reduce((s, t) => s + t.netPnl, 0) / total) * 100) / 100 : 0;
    const avgPerDay = tradingDays > 0 ? Math.round((total / tradingDays) * 100) / 100 : 0;
    return { profitFactor, tradingDays, avgPerTrade, avgPerDay };
  });

  // Mon-Fri stats. Win rate matches /trades/summary: wins / all trades that day,
  // so breakevens count toward the total. Weekend-dated trades aren't shown.
  performanceByDay = computed(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((name) => ({
      name,
      wins: 0,
      losses: 0,
      total: 0,
      winRate: 0,
    }));

    for (const trade of this.trades()) {
      const [year, month, day] = trade.trade_date.substring(0, 10).split('-').map(Number);
      // setUTCFullYear, not Date.UTC: Date.UTC maps years 0-99 to 1900-1999
      const date = new Date(0);
      date.setUTCFullYear(year, month - 1, day);
      const weekday = date.getUTCDay();
      if (weekday === 0 || weekday === 6) continue;

      const stats = days[weekday - 1];
      stats.total += 1;
      if (trade.netPnl > 0) stats.wins += 1;
      else if (trade.netPnl < 0) stats.losses += 1;
    }

    for (const stats of days) {
      stats.winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
    }
    return days;
  });

  calendar = computed(() => buildCalendarMonth(this.trades(), this.calendarMonth(), todayLocal()));
  readonly dayStyle = dayStyle;

  absValue(n: number): number {
    return Math.abs(n);
  }

  equityChart = computed(() => buildEquityChart(this.trades()));
  readonly chartViewBox = `0 0 ${CHART.width} ${CHART_HEIGHT}`;
  readonly layout = CHART;
  hoverIndex = signal<number | null>(null);

  hoveredPoint = computed(() => {
    const chart = this.equityChart();
    const index = this.hoverIndex();
    return chart && index !== null ? chart.points[index] : null;
  });

  // Keeps the tooltip inside the chart near the left and right edges
  tooltipLeft = computed(() => {
    const point = this.hoveredPoint();
    return point ? Math.min(88, Math.max(12, (point.x / CHART.width) * 100)) : 0;
  });

  onChartHover(event: MouseEvent) {
    const chart = this.equityChart();
    if (!chart) return;
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CHART.width;
    const plotWidth = CHART.width - CHART.left - CHART.right;
    const steps = chart.points.length - 1;
    const index = Math.round(((x - CHART.left) / plotWidth) * steps);
    this.hoverIndex.set(Math.min(steps, Math.max(1, index)));
  }

  edgeRange = signal<'month' | 'all'>('all');
  edgeMonth = signal<YearMonth>(currentMonth());

  edge = computed(() => {
    const trades = this.trades();
    if (this.edgeRange() === 'all') return buildEdgeAnalytics(trades);
    return buildEdgeAnalytics(tradesInMonth(trades, this.edgeMonth()));
  });

  gradeMax = computed(() => Math.max(1, ...this.edge().grades.map((g) => g.total)));

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

  dailyTrades = computed(() => {
    const map = new Map<string, any[]>();
    for (const trade of this.trades()) {
      const date = trade.trade_date.substring(0, 10);
      const list = map.get(date) || [];
      list.push(trade);
      map.set(date, list);
    }
    return map;
  });

  selectedDayTrades = signal<any[] | null>(null);
  selectedDayDate = signal('');

  onDayClick(date: string | null) {
    if (!date) return;
    const trades = this.dailyTrades().get(date);
    if (!trades || trades.length === 0) return;

    this.selectedDayTrades.set(trades);
    this.selectedDayDate.set(date);
  }

  closeDayPopover() {
    this.selectedDayTrades.set(null);
  }

  goToTrade(id: number) {
    this.selectedDayTrades.set(null);
    this.router.navigate(['/trades', id]);
  }

  selectedDayLabel(): string {
    const dateStr = this.selectedDayDate();
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    return `${weekday}, ${monthName} ${day}, ${year}`;
  }

  dayNetPnl(): number {
    const trades = this.selectedDayTrades() || [];
    return Math.round(trades.reduce((sum, t) => sum + t.netPnl, 0) * 100) / 100;
  }

  dayWinRate(): number {
    const trades = this.selectedDayTrades() || [];
    if (trades.length === 0) return 0;
    const wins = trades.filter((t) => t.netPnl > 0).length;
    return Math.round((wins / trades.length) * 100);
  }

  dayWinLossCounts(): { wins: number; losses: number } {
    const trades = this.selectedDayTrades() || [];
    return {
      wins: trades.filter((t) => t.netPnl > 0).length,
      losses: trades.filter((t) => t.netPnl < 0).length,
    };
  }

  dayRulesMetPercent(): number | null {
    const trades = (this.selectedDayTrades() || []).filter((t) => t.rulesFollowed !== null);
    if (trades.length === 0) return null;
    const followed = trades.filter((t) => t.rulesFollowed === true).length;
    return Math.round((followed / trades.length) * 100);
  }

  tradePointDiff(trade: any): number {
    const diff =
      trade.direction === 'long'
        ? trade.exit_price - trade.entry_price
        : trade.entry_price - trade.exit_price;
    return Math.round(diff * 100) / 100;
  }
  dateRangeLabel(): string {
    const trades = this.trades();
    if (trades.length === 0) return 'No trades yet';
    const sorted = [...trades].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    const format = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const first = format(sorted[0].trade_date.substring(0, 10));
    const last = format(sorted[sorted.length - 1].trade_date.substring(0, 10));
    return first === last ? first : `${first} - ${last}`;
  }
}
