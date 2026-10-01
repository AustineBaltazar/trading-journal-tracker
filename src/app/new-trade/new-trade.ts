import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  imports: [FormsModule],
  selector: 'app-new-trade',
  styleUrl: './new-trade.css',
  templateUrl: './new-trade.html',
})
export class NewTrade {
  private http = inject(HttpClient);
  private router = inject(Router);

  trade_date = '';
  symbol = 'MNQ';
  direction = 'long';
  contracts = 1;
  entry_price = 0;
  exit_price = 0;
  fees = 0;
  strategy = '';

  errorMessage = '';

  onSubmit() {
    this.errorMessage = '';
    const token = localStorage.getItem('token');

    this.http
      .post<any>(
        'http://localhost:3001/trades',
        {
          trade_date: this.trade_date,
          symbol: this.symbol,
          direction: this.direction,
          contracts: this.contracts,
          entry_price: this.entry_price,
          exit_price: this.exit_price,
          fees: this.fees,
          strategy: this.strategy,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/trades']);
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong saving the trade.';
        },
      });
  }
}
