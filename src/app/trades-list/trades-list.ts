import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  imports: [],
  selector: 'app-trades-list',
  styleUrl: './trades-list.css',
  templateUrl: './trades-list.html',
})
export class TradesList implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  trades = signal<any[]>([]);

  ngOnInit() {
    const token = localStorage.getItem('token');

    this.http
      .get<any>('http://localhost:3001/trades', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe((response) => {
        this.trades.set(response.trades);
      });
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}
