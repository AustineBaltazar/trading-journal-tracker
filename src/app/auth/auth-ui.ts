import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { passwordStrength, sameAsEmail } from './auth';

// The logo and centred card shared by the login, sign-up and email pages
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4">
      <div class="w-full max-w-sm">
        <div class="flex flex-col items-center gap-3 mb-8">
          <div
            class="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-400 p-[1.5px] flex items-center justify-center shadow-lg shadow-blue-500/20"
          >
            <div class="h-full w-full bg-[#0B0E14] rounded-[14px] flex items-center justify-center">
              <svg
                class="w-6 h-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="font-extrabold tracking-tight text-white text-lg">MNQ</span>
            <span class="text-sm text-slate-500 font-mono">/</span>
            <span class="text-sm font-semibold text-slate-300 tracking-wider">JOURNAL</span>
            <span
              class="ml-1 text-[9.5px] font-bold tracking-wider px-1.5 py-px rounded-full border border-amber-400/45 text-amber-300 bg-amber-400/10"
              >BETA</span
            >
          </div>
        </div>
        <div class="bg-[#121722] border border-[#1F293D] rounded-2xl p-6 shadow-xl">
          <ng-content />
        </div>
        <p class="text-center text-[11px] text-slate-600 mt-5">
          <a routerLink="/privacy" class="hover:text-slate-400">Privacy</a> ·
          <a routerLink="/terms" class="hover:text-slate-400">Terms</a>
        </p>
      </div>
    </div>
  `,
})
export class AuthShell {}

// Strength bars and the live rules under a new-password field
@Component({
  selector: 'app-password-strength',
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-4 gap-1 mt-2" aria-hidden="true">
      @for (bar of bars; track bar) {
        <span
          class="h-1 rounded-full"
          [class]="
            bar > strength().score
              ? 'bg-slate-800'
              : strength().score <= 1
                ? 'bg-rose-500'
                : strength().score === 2
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
          "
        ></span>
      }
    </div>
    <p class="sr-only" aria-live="polite">{{ strength().label }}</p>
    <ul [id]="rulesId()" class="text-[11.5px] mt-2 space-y-0.5">
      <li [class]="longEnough() ? 'text-emerald-300' : 'text-slate-500'">
        {{ longEnough() ? '✓' : '○' }} At least 12 characters
      </li>
      <li [class]="notEmail() ? 'text-emerald-300' : 'text-slate-500'">
        {{ notEmail() ? '✓' : '○' }} Different from your email
      </li>
      <li class="text-slate-500">○ Not found in known data leaks (checked when you save)</li>
    </ul>
  `,
})
export class PasswordStrength {
  password = input('');
  email = input('');
  rulesId = input('password-rules');

  readonly bars = [1, 2, 3, 4];
  readonly strength = computed(() => passwordStrength(this.password()));
  readonly longEnough = computed(() => this.password().length >= 12);
  readonly notEmail = computed(
    () => !!this.password() && !sameAsEmail(this.password(), this.email()),
  );
}

// The rules a new password must pass before the form can be sent
export function newPasswordOk(password: string, email: string) {
  return password.length >= 12 && !sameAsEmail(password, email);
}

// Reads ?token= from the address bar, then removes it so it isn't left in
// the history or shown on screen
export function takeTokenFromUrl(): string {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token') ?? '';
  if (token) {
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }
  return token;
}
