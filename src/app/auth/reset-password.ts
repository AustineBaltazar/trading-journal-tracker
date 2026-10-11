import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import { AuthShell, PasswordStrength, newPasswordOk, takeTokenFromUrl } from './auth-ui';

// The page the reset email links to
@Component({
  selector: 'app-reset-password',
  imports: [AuthShell, FormsModule, RouterLink, PasswordStrength],
  template: `
    <app-auth-shell>
      @switch (state()) {
        @case ('checking') {
          <p class="text-sm text-slate-400 py-6 text-center" role="status">Checking your link…</p>
        }
        @case ('expired') {
          <div class="text-center">
            <h1 class="text-lg font-semibold text-white mb-1">This link has expired</h1>
            <p class="text-xs text-slate-400 mb-5">
              Reset links work for 30 minutes and only once.
            </p>
            <a
              routerLink="/forgot-password"
              class="block w-full border border-[#1F293D] text-slate-300 hover:text-white hover:border-slate-500 text-sm py-2.5 rounded-xl transition"
              >Send a new link</a
            >
          </div>
        }
        @default {
          <form (ngSubmit)="save()">
            <h1 class="text-lg font-semibold text-white mb-1">Choose a new password</h1>
            <p class="text-xs text-slate-400 mb-6">For {{ email() }}</p>

            @if (errorMessage()) {
              <p
                role="alert"
                class="text-rose-300 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4"
              >
                {{ errorMessage() }}
              </p>
            }

            <label for="new-password" class="block text-xs font-medium text-slate-300 mb-1.5"
              >New password</label
            >
            <div class="relative">
              <input
                id="new-password"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="new-password"
                maxlength="128"
                [(ngModel)]="password"
                name="password"
                aria-describedby="reset-password-rules"
                class="w-full bg-[#0E131C] border border-[#1F293D] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm rounded-xl pl-3.5 pr-16 py-2.5 transition"
              />
              <button
                type="button"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-pressed]="showPassword()"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1"
              >
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
            <app-password-strength
              class="mb-4"
              rulesId="reset-password-rules"
              [password]="password"
              [email]="email()"
            />

            <label class="flex items-center gap-2 text-xs text-slate-400 mb-5 cursor-pointer">
              <input
                type="checkbox"
                [(ngModel)]="logoutOthers"
                name="logoutOthers"
                class="h-3.5 w-3.5 rounded border-slate-600 bg-[#0E131C] accent-blue-600"
              />
              Log out all my other devices
            </label>

            <button
              type="submit"
              [disabled]="!canSave"
              class="w-full bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving() ? 'Saving…' : 'Save new password' }}
            </button>
          </form>
        }
      }
    </app-auth-shell>
  `,
})
export class ResetPassword implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private token = '';

  state = signal<'checking' | 'ready' | 'expired'>('checking');
  email = signal('');
  password = '';
  logoutOthers = true;
  showPassword = signal(false);
  saving = signal(false);
  errorMessage = signal('');

  get canSave() {
    return !this.saving() && newPasswordOk(this.password, this.email());
  }

  ngOnInit() {
    this.token = takeTokenFromUrl();
    if (!this.token) {
      this.state.set('expired');
      return;
    }
    this.http
      .post<{ email: string }>(`${environment.apiUrl}/reset-password/check`, { token: this.token })
      .subscribe({
        next: (response) => {
          this.email.set(response.email);
          this.state.set('ready');
        },
        error: () => this.state.set('expired'),
      });
  }

  save() {
    if (!this.canSave) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.http
      .post<any>(`${environment.apiUrl}/reset-password`, {
        token: this.token,
        password: this.password,
        logoutOthers: this.logoutOthers,
      })
      .subscribe({
        next: (response) => {
          this.auth.signedIn(response.user);
          this.router.navigate(['/trades']);
        },
        error: (err) => {
          this.saving.set(false);
          if (err.error?.expired) this.state.set('expired');
          else
            this.errorMessage.set(err.error?.error || 'Something went wrong saving your password.');
        },
      });
  }
}
