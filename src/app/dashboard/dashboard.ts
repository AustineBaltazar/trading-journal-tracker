import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private http = inject(HttpClient);
  summary = signal<any>(null);

  ngOnInit() {
    const token = localStorage.getItem('token');

    this.http
      .get<any>('http://localhost:3001/trades/summary', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe((response) => {
        this.summary.set(response);
      });
  }
}
