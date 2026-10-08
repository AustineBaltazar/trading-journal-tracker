import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {
  private http = inject(HttpClient);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  errorMessage = signal('');
  successMessage = '';

  onSubmit() {
    this.errorMessage.set('');
    this.successMessage = '';

    this.http
      .post<any>(`${environment.apiUrl}/register`, {
        name: this.name,
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.successMessage = 'Account created. Redirecting to login...';
          setTimeout(() => this.router.navigate(['/login']), 1500);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Something went wrong creating your account.');
        },
      });
  }
}
