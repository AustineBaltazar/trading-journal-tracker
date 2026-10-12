import { Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthShell } from './auth-ui';
import { Turnstile, turnstileOn } from './turnstile';

// Asks for a reset link. The answer is the same whether or not the email has an account.
@Component({
  selector: 'app-forgot-password',
  imports: [AuthShell, FormsModule, RouterLink, Turnstile],
  template: `
    <app-auth-shell>
      <form (ngSubmit)="send()">
        <h1 class="text-lg font-semibold text-white mb-1">Reset your password</h1>
        <p class="text-xs text-slate-400 mb-6">
          Enter your email and we'll send you a link to choose a new password.
        </p>

        @if (sent()) {
          <p
            role="status"
            class="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2 mb-4"
          >
            If that email has an account, a reset link is on its way. It works for 30 minutes. Check
            Spam if it isn't there in a minute.
          </p>
        } @else {
          @if (errorMessage()) {
            <p
              role="alert"
              class="text-rose-300 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4"
            >
              {{ errorMessage() }}
            </p>
          }
          <label for="forgot-email" class="block text-xs font-medium text-slate-300 mb-1.5"
            >Email</label
          >
          <input
            id="forgot-email"
            type="email"
            autocomplete="email"
            [(ngModel)]="email"
            name="email"
            class="w-full bg-tone-0e131c border border-tone-1f293d focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 mb-4 transition"
          />
          @if (turnstileOn) {
            <app-turnstile class="mb-4" (token)="turnstileToken.set($event)" />
          }
          <button
            type="submit"
            [disabled]="sending() || !email.trim() || (turnstileOn && !turnstileToken())"
            class="w-full bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-on-solid font-semibold text-sm py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ sending() ? 'Sending…' : 'Send reset link' }}
          </button>
        }
        <p class="text-center text-xs text-slate-500 mt-5">
          <a routerLink="/login" class="text-blue-400 hover:text-blue-300">‹ Back to log in</a>
        </p>
      </form>
    </app-auth-shell>
  `,
})
export class ForgotPassword {
  private http = inject(HttpClient);
  private turnstile = viewChild(Turnstile);
  email = '';
  sending = signal(false);
  sent = signal(false);
  errorMessage = signal('');
  turnstileToken = signal<string | null>(null);
  readonly turnstileOn = turnstileOn();

  send() {
    if (this.sending() || !this.email.trim()) return;
    this.sending.set(true);
    this.errorMessage.set('');
    this.http
      .post(`${environment.apiUrl}/forgot-password`, {
        email: this.email,
        turnstileToken: this.turnstileToken() ?? undefined,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.sent.set(true);
        },
        error: (err) => {
          this.sending.set(false);
          this.errorMessage.set(err.error?.error || 'Something went wrong sending the email.');
          this.turnstile()?.reset();
        },
      });
  }
}
