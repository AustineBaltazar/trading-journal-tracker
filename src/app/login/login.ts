import { Component, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService, formatWait } from '../auth/auth';
import { Turnstile, turnstileOn } from '../auth/turnstile';
import { AuthShell } from '../auth/auth-ui';

@Component({
  imports: [FormsModule, RouterLink, Turnstile, AuthShell],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login implements OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private turnstile = viewChild(Turnstile);

  email = '';
  password = '';
  remember = true;
  showPassword = signal(false);
  submitting = signal(false);
  errorMessage = signal('');
  // Tries left before a short wait, shown once it gets low
  attemptsLeft = signal<number | null>(null);
  // The server asks for the human check after a few wrong passwords
  captchaRequired = signal(false);
  turnstileToken = signal<string | null>(null);
  waitSeconds = signal(0);
  // Right password, but the email isn't confirmed yet
  unverified = signal(false);
  resent = signal(false);
  private countdown: ReturnType<typeof setInterval> | null = null;

  readonly turnstileOn = turnstileOn();
  readonly formatWait = formatWait;

  onSubmit() {
    if (this.submitting() || this.waitSeconds() > 0) return;
    if (this.captchaRequired() && this.turnstileOn && !this.turnstileToken()) {
      this.errorMessage.set('Please complete the check below.');
      return;
    }
    this.errorMessage.set('');
    this.unverified.set(false);
    this.submitting.set(true);

    this.http
      .post<any>(`${environment.apiUrl}/login`, {
        email: this.email,
        password: this.password,
        remember: this.remember,
        turnstileToken: this.turnstileToken() ?? undefined,
      })
      .subscribe({
        next: (response) => {
          this.auth.signedIn(response.user);
          this.router.navigate(['/trades']);
        },
        error: (err) => {
          const body = err.error ?? {};
          this.submitting.set(false);
          this.errorMessage.set(body.error || 'Something went wrong logging in.');
          this.attemptsLeft.set(err.status === 401 ? (body.attemptsLeft ?? null) : null);
          if (body.captchaRequired) this.captchaRequired.set(true);
          if (err.status === 429 && body.retryAfter) this.startWait(body.retryAfter);
          if (body.unverified) {
            this.unverified.set(true);
            this.resent.set(false);
          }
          this.turnstile()?.reset();
        },
      });
  }

  resendLink() {
    this.http
      .post(`${environment.apiUrl}/resend-verification`, { email: this.email })
      .subscribe({ next: () => this.resent.set(true), error: () => this.resent.set(true) });
  }

  private startWait(seconds: number) {
    this.stopWait();
    this.waitSeconds.set(seconds);
    this.countdown = setInterval(() => {
      this.waitSeconds.update((s) => s - 1);
      if (this.waitSeconds() <= 0) {
        this.stopWait();
        this.errorMessage.set('');
      }
    }, 1000);
  }

  private stopWait() {
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = null;
  }

  ngOnDestroy() {
    this.stopWait();
  }
}
