import { Component, inject, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService, passwordStrength } from '../auth/auth';
import { AuthShell, PasswordStrength, newPasswordOk } from '../auth/auth-ui';
import { Turnstile, turnstileOn } from '../auth/turnstile';
import { GoogleEntry } from '../auth/google-entry';
import { BRAND } from '../brand';

@Component({
  imports: [
    FormsModule,
    RouterLink,
    Turnstile,
    AuthShell,
    PasswordStrength,
    GoogleEntry,
    NgTemplateOutlet,
  ],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {
  readonly brand = BRAND;
  // true on the /start landing page, where the form sits inside the page
  readonly embedded = input(false);
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
  acceptTerms = false;

  readonly turnstileOn = turnstileOn();

  get strength() {
    return passwordStrength(this.password);
  }

  get canSubmit() {
    return (
      !this.submitting() &&
      this.acceptTerms &&
      newPasswordOk(this.password, this.email) &&
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
        acceptTerms: this.acceptTerms,
        turnstileToken: this.turnstileToken() ?? undefined,
      })
      .subscribe({
        // The same answer whether or not the email already had an account
        next: () => {
          this.auth.pendingEmail.set(this.email.trim().toLowerCase());
          this.router.navigate(['/check-email']);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err.error?.error || 'Something went wrong creating your account.');
          this.turnstile()?.reset();
        },
      });
  }
}
