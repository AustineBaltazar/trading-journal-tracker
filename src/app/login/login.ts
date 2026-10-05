import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private http = inject(HttpClient);
  private router = inject(Router);

  email = '';
  password = '';
  errorMessage = '';

  onSubmit() {
    this.errorMessage = '';

    this.http
      .post<any>(`${environment.apiUrl}/login`, {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (response) => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('userName', response.user?.name || '');
          this.router.navigate(['/trades']);
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong logging in.';
        },
      });
  }
}
