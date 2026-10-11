import { Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService, passwordStrength, sameAsEmail } from '../auth/auth';
import { Turnstile, turnstileOn } from '../auth/turnstile';

@Component({
  imports: [FormsModule, RouterLink, Turnstile],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private turnstile = viewChild(Turnstile);

  name = '';
  email = '';
  password = '';
  showPassword = signal(false);
  submitting = signal(false);
  errorMessage = signal('');
  turnstileToken = signal<string | null>(null);

  readonly turnstileOn = turnstileOn();
  readonly bars = [1, 2, 3, 4];

  get strength() {
    return passwordStrength(this.password);
  }

  get longEnough() {
    return this.password.length >= 12;
  }

  get notEmail() {
    return !!this.password && !sameAsEmail(this.password, this.email);
  }

  get canSubmit() {
    return (
      !this.submitting() &&
      this.longEnough &&
      this.notEmail &&
      (!this.turnstileOn || !!this.turnstileToken())
    );
  }

  onSubmit() {
    if (!this.canSubmit) return;
    this.errorMessage.set('');
    this.submitting.set(true);

    this.http
      .post<any>(`${environment.apiUrl}/register`, {
        name: this.name,
        email: this.email,
        password: this.password,
        turnstileToken: this.turnstileToken() ?? undefined,
      })
      .subscribe({
        next: (response) => {
          this.auth.signedIn(response.user);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err.error?.error || 'Something went wrong creating your account.');
          this.turnstile()?.reset();
        },
      });
  }
}
