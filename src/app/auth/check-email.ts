import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import { AuthShell } from './auth-ui';

const RESEND_WAIT = 60;

// After sign-up (or "resend the link"). Says the same thing whether or not the
// address already had an account.
@Component({
  selector: 'app-check-email',
  imports: [AuthShell, RouterLink, FormsModule],
  template: `
    <app-auth-shell>
      <div class="text-center">
        <div
          class="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center bg-blue-500/10 border border-blue-500/30 text-xl"
          aria-hidden="true"
        >
          ✉️
        </div>
        <h1 class="text-lg font-semibold text-white mb-1">Check your email</h1>
        <p class="text-xs text-slate-400 mb-4">
          @if (email) {
            If <b class="text-slate-200">{{ email }}</b> is new here, we sent a link to finish
            signing up.
          } @else {
            We sent a link to finish signing up.
          }
          It works for <b class="text-slate-200">30 minutes</b>.
        </p>
      </div>
      <p
        class="text-xs text-blue-100 bg-blue-500/10 border border-blue-500/25 rounded-lg px-3 py-2 mb-4"
      >
        Not there? Check <b>Spam</b> or <b>Promotions</b>. It comes from
        <span class="font-mono">brotradingjournal&#64;gmail.com</span>.
      </p>

      @if (!email) {
        <label for="resend-email" class="block text-xs font-medium text-slate-300 mb-1.5"
          >Your email</label
        >
        <input
          id="resend-email"
          type="email"
          autocomplete="email"
          [(ngModel)]="typedEmail"
          class="w-full bg-[#0E131C] border border-[#1F293D] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 mb-3 transition"
        />
      }
      <button
        type="button"
        (click)="resend()"
        [disabled]="wait() > 0 || sending()"
        class="w-full border border-[#1F293D] text-slate-300 hover:text-white hover:border-slate-500 text-sm py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ wait() > 0 ? 'Resend email in 0:' + (wait() < 10 ? '0' : '') + wait() : 'Resend email' }}
      </button>
      @if (note()) {
        <p class="text-[11px] text-slate-400 text-center mt-2" role="status">{{ note() }}</p>
      }
      <p class="text-center text-xs text-slate-500 mt-5">
        <a routerLink="/register" class="text-blue-400 hover:text-blue-300"
          >Use a different email</a
        >
        ·
        <a routerLink="/login" class="text-blue-400 hover:text-blue-300">Log in</a>
      </p>
    </app-auth-shell>
  `,
})
export class CheckEmail implements OnDestroy {
  private http = inject(HttpClient);
  readonly email = inject(AuthService).pendingEmail();
  typedEmail = '';
  wait = signal(this.email ? RESEND_WAIT : 0);
  sending = signal(false);
  note = signal('');
  private timer = setInterval(() => this.wait.update((s) => Math.max(0, s - 1)), 1000);

  resend() {
    const email = this.email || this.typedEmail;
    if (!email || this.wait() > 0) return;
    this.sending.set(true);
    this.http.post(`${environment.apiUrl}/resend-verification`, { email }).subscribe({
      next: () => {
        this.sending.set(false);
        this.note.set('Sent again. Links from earlier emails still work until they expire.');
        this.wait.set(RESEND_WAIT);
      },
      error: (err) => {
        this.sending.set(false);
        this.note.set(err.error?.error || 'Something went wrong sending the email.');
      },
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
