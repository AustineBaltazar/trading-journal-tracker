import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  imports: [FormsModule],
  selector: 'app-edit-trade',
  styleUrl: './edit-trade.css',
  templateUrl: './edit-trade.html',
})
export class EditTrade implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  tradeId = '';
  loaded = signal(false);

  trade_date = '';
  symbol = '';
  direction = '';
  contracts = 0;
  entry_price = 0;
  exit_price = 0;
  fees = 0;
  strategy = '';

  errorMessage = '';

  ngOnInit() {
    this.tradeId = this.route.snapshot.paramMap.get('id')!;
    const token = localStorage.getItem('token');

    this.http
      .get<any>(`http://localhost:3001/trades/${this.tradeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe((trade) => {
        this.trade_date = trade.trade_date.substring(0, 10);
        this.symbol = trade.symbol;
        this.direction = trade.direction;
        this.contracts = trade.contracts;
        this.entry_price = trade.entry_price;
        this.exit_price = trade.exit_price;
        this.fees = trade.fees;
        this.strategy = trade.strategy;
        this.loaded.set(true);
      });
  }

  onSubmit() {
    this.errorMessage = '';
    const token = localStorage.getItem('token');

    this.http
      .put<any>(
        `http://localhost:3001/trades/${this.tradeId}`,
        {
          trade_date: this.trade_date,
          symbol: this.symbol,
          direction: this.direction,
          contracts: this.contracts,
          entry_price: this.entry_price,
          exit_price: this.exit_price,
          fees: this.fees,
          strategy: this.strategy,
          screenshot_link: null,
          notes: null,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => this.router.navigate(['/trades']),
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong updating the trade.';
        },
      });
  }
}
