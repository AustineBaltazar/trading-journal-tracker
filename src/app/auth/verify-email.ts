import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import { AuthShell, takeTokenFromUrl } from './auth-ui';

// The page the confirmation email links to. Confirms and logs straight in.
@Component({
  selector: 'app-verify-email',
  imports: [AuthShell, RouterLink],
  template: `
    <app-auth-shell>
      <div class="text-center" role="status">
        @switch (state()) {
          @case ('checking') {
            <p class="text-sm text-slate-400 py-6">Confirming your email…</p>
          }
          @case ('done') {
            <div
              class="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xl"
              aria-hidden="true"
            >
              ✓
            </div>
            <h1 class="text-lg font-semibold text-white mb-1">You're in</h1>
            <p class="text-xs text-slate-400 mb-5">
              Email confirmed. Your journal is ready, with starter mistakes and tag groups already
              set up.
            </p>
            <button
              type="button"
              (click)="go()"
              class="w-full bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-on-solid font-semibold text-sm py-2.5 rounded-xl shadow-lg transition-all"
            >
              Go to dashboard
            </button>
          }
          @default {
            <h1 class="text-lg font-semibold text-white mb-1">This link has expired</h1>
            <p class="text-xs text-slate-400 mb-5">
              Links work for 30 minutes and only once. If you already confirmed, just log in.
            </p>
            <a
              routerLink="/check-email"
              class="block w-full border border-tone-1f293d text-slate-300 hover:text-white hover:border-slate-500 text-sm py-2.5 rounded-xl transition mb-3"
              >Send a new link</a
            >
            <a routerLink="/login" class="text-xs text-blue-400 hover:text-blue-300">Log in</a>
          }
        }
      </div>
    </app-auth-shell>
  `,
})
export class VerifyEmail implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  state = signal<'checking' | 'done' | 'expired'>('checking');

  ngOnInit() {
    const token = takeTokenFromUrl();
    if (!token) {
      this.state.set('expired');
      return;
    }
    this.http.post<any>(`${environment.apiUrl}/verify-email`, { token }).subscribe({
      next: (response) => {
        this.auth.signedIn(response.user);
        this.auth.pendingEmail.set('');
        this.state.set('done');
      },
      error: () => this.state.set('expired'),
    });
  }

  go() {
    this.router.navigate(['/dashboard']);
  }
}
