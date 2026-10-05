import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewTrade } from '../new-trade/new-trade';
import { environment } from '../../environments/environment';

@Component({
  imports: [SlicePipe, FormsModule, NewTrade],
  selector: 'app-trades-list',
  styleUrl: './trades-list.css',
  templateUrl: './trades-list.html',
})
export class TradesList implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  trades = signal<any[]>([]);
  showNewTradeModal = signal(false);

  viewedYear = signal(new Date().getFullYear());
  viewedMonth = signal(new Date().getMonth());

  searchText = signal('');
  outcomeFilter = signal<'all' | 'wins' | 'losses'>('all');

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

  monthTrades = computed(() => {
    const year = this.viewedYear();
    const month = this.viewedMonth();
    return this.trades().filter((trade) => {
      const date = new Date(trade.trade_date);
      return date.getUTCFullYear() === year && date.getUTCMonth() === month;
    });
  });

  monthSummary = computed(() => {
    const trades = this.monthTrades();
    const wins = trades.filter((t) => t.netPnl > 0).length;
    const losses = trades.filter((t) => t.netPnl < 0).length;
    const netPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
    const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 1000) / 10 : 0;
    return { total: trades.length, wins, losses, netPnl: Math.round(netPnl * 100) / 100, winRate };
  });

  filteredTrades = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    const outcome = this.outcomeFilter();
    return this.monthTrades().filter((trade) => {
      const matchesSearch = !search || (trade.strategy || '').toLowerCase().includes(search);
      const matchesOutcome =
        outcome === 'all' ||
        (outcome === 'wins' && trade.netPnl > 0) ||
        (outcome === 'losses' && trade.netPnl < 0);
      return matchesSearch && matchesOutcome;
    });
  });

  ngOnInit() {
    this.loadTrades();
  }

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  loadTrades() {
    this.http
      .get<any>(`${environment.apiUrl}/trades`, this.authHeaders())
      .subscribe((response) => this.trades.set(response.trades));
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

  setOutcomeFilter(value: 'all' | 'wins' | 'losses') {
    this.outcomeFilter.set(value);
  }

  viewTrade(id: number) {
    this.router.navigate(['/trades', id]);
  }

  openNewTradeModal() {
    this.showNewTradeModal.set(true);
  }
  closeNewTradeModal() {
    this.showNewTradeModal.set(false);
  }
  onTradeCreated() {
    this.showNewTradeModal.set(false);
    this.loadTrades();
  }
}
