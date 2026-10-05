import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  imports: [RouterLink, DecimalPipe, UpperCasePipe],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  summary = signal<any>(null);
  trades = signal<any[]>([]);
  ruleAdherence = signal<any[]>([]);
  ruleStats = signal<any>(null);

  viewedYear = signal(new Date().getFullYear());
  viewedMonth = signal(new Date().getMonth());

  monthLabel = computed(() => {
    const names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${names[this.viewedMonth()]} ${this.viewedYear()}`;
  });

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  ngOnInit() {
    this.http
      .get<any>(`${environment.apiUrl}/trades/summary`, this.authHeaders())
      .subscribe((response) => this.summary.set(response));

    this.http
      .get<any>(`${environment.apiUrl}/trades`, this.authHeaders())
      .subscribe((response) => this.trades.set(response.trades));

    this.http
      .get<any>(`${environment.apiUrl}/rule-adherence`, this.authHeaders())
      .subscribe((response) => {
        this.ruleAdherence.set(response.adherence);
        this.ruleStats.set(response);
      });
  }

  previousMonth() {
    if (this.viewedMonth() === 0) {
      this.viewedMonth.set(11);
      this.viewedYear.update((y) => y - 1);
    } else this.viewedMonth.update((m) => m - 1);
  }

  nextMonth() {
    if (this.viewedMonth() === 11) {
      this.viewedMonth.set(0);
      this.viewedYear.update((y) => y + 1);
    } else this.viewedMonth.update((m) => m + 1);
  }

  dailyPnl = computed(() => {
    const map = new Map<string, number>();
    for (const trade of this.trades()) {
      const date = trade.trade_date.substring(0, 10);
      map.set(date, (map.get(date) || 0) + trade.netPnl);
    }
    return map;
  });

  dailyCount = computed(() => {
    const map = new Map<string, number>();
    for (const trade of this.trades()) {
      const date = trade.trade_date.substring(0, 10);
      map.set(date, (map.get(date) || 0) + 1);
    }
    return map;
  });

  monthlyTotal = computed(() => {
    const prefix = `${this.viewedYear()}-${String(this.viewedMonth() + 1).padStart(2, '0')}`;
    let total = 0;
    for (const [date, val] of this.dailyPnl()) {
      if (date.startsWith(prefix)) total += val;
    }
    return Math.round(total * 100) / 100;
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

  calendarDays = computed(() => {
    const year = this.viewedYear();
    const month = this.viewedMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const weeks: { day: number | null; date: string | null }[][] = [];
    let currentWeek: { day: number | null; date: string | null }[] = [];
    const firstWeekday = firstDay.getDay();
    const startOffset = firstWeekday === 0 ? 4 : firstWeekday - 1;

    for (let i = 0; i < startOffset; i++) currentWeek.push({ day: null, date: null });

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const weekday = dateObj.getDay();
      if (weekday === 0 || weekday === 6) continue;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      currentWeek.push({ day: d, date: dateStr });
      if (currentWeek.length === 5) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 5) currentWeek.push({ day: null, date: null });
      weeks.push(currentWeek);
    }

    return weeks;
  });

  absValue(n: number): number {
    return Math.abs(n);
  }

  chartData = computed(() => {
    const sorted = [...this.trades()].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    let runningTotal = 0;
    const points: { value: number; date: string }[] = [];
    for (const trade of sorted) {
      runningTotal += trade.netPnl;
      points.push({ value: runningTotal, date: trade.trade_date.substring(0, 10) });
    }
    if (points.length === 0) {
      return {
        linePoints: '',
        areaPoints: '',
        maxValue: 0,
        firstDate: '',
        lastDate: '',
        lastX: 0,
        lastY: 0,
      };
    }
    const width = 600,
      height = 150;
    const values = points.map((p) => p.value);
    const maxValue = Math.max(...values, 0);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    const coords = points.map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - ((point.value - minValue) / range) * height;
      return { x, y };
    });
    const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const areaPoints = `0,${height} ${linePoints} ${width},${height}`;
    return {
      linePoints,
      areaPoints,
      maxValue,
      firstDate: points[0].date,
      lastDate: points[points.length - 1].date,
      lastX: coords[coords.length - 1].x,
      lastY: coords[coords.length - 1].y,
    };
  });

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
