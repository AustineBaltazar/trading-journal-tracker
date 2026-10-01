import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  imports: [FormsModule],
  selector: 'app-rules',
  styleUrl: './rules.css',
  templateUrl: './rules.html',
})
export class Rules implements OnInit {
  private http = inject(HttpClient);

  rules = signal<any[]>([]);
  newRuleName = '';
  errorMessage = '';

  ngOnInit() {
    this.loadRules();
  }

  loadRules() {
    const token = localStorage.getItem('token');
    this.http
      .get<any>('http://localhost:3001/rules', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe((response) => {
        this.rules.set(response.rules);
      });
  }

  addRule() {
    this.errorMessage = '';
    const token = localStorage.getItem('token');

    this.http
      .post<any>(
        'http://localhost:3001/rules',
        { name: this.newRuleName },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (newRule) => {
          this.rules.update((current) => [...current, newRule]);
          this.newRuleName = '';
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong adding the rule.';
        },
      });
  }

  deleteRule(id: number) {
    const token = localStorage.getItem('token');
    this.http
      .delete<any>(`http://localhost:3001/rules/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe(() => {
        this.rules.update((current) => current.filter((rule) => rule.id !== id));
      });
  }
}
