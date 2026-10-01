import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  imports: [],
  selector: 'app-trades-list',
  styleUrl: './trades-list.css',
  templateUrl: './trades-list.html',
})
export class TradesList implements OnInit {
  private http = inject(HttpClient);
  trades = signal<any[]>([]);

  ngOnInit() {
    this.http.get<any>('http://localhost:3001/trades').subscribe((response) => {
      this.trades.set(response.trades);
    });
  }
}
