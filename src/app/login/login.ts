import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  imports: [FormsModule],
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
      .post<any>('http://localhost:3001/login', {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (response) => {
          localStorage.setItem('token', response.token);
          this.router.navigate(['/trades']);
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong logging in.';
        },
      });
  }
}
