import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import { AuthShell } from './auth-ui';

// First "Continue with Google": the name and the Terms, then the account is made
@Component({
  selector: 'app-welcome',
  imports: [AuthShell, FormsModule, RouterLink],
  template: `
    <app-auth-shell>
      <form (ngSubmit)="create()">
        <h1 class="text-lg font-semibold text-white mb-1">Welcome to MNQ Journal</h1>
        <p class="text-xs text-slate-400 mb-6">
          Signing up with Google as <b class="text-slate-200">{{ email }}</b>
        </p>

        @if (errorMessage()) {
          <p
            role="alert"
            class="text-rose-300 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4"
          >
            {{ errorMessage() }}
          </p>
        }

        <label for="welcome-name" class="block text-xs font-medium text-slate-300 mb-1.5"
          >Name</label
        >
        <input
          id="welcome-name"
          name="name"
          maxlength="60"
          autocomplete="name"
          [(ngModel)]="name"
          class="w-full bg-[#0E131C] border border-[#1F293D] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 mb-4 transition"
        />

        <label class="flex items-start gap-2 text-xs text-slate-400 mb-5 cursor-pointer">
          <input
            type="checkbox"
            [(ngModel)]="acceptTerms"
            name="acceptTerms"
            class="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-[#0E131C] accent-blue-600"
          />
          <span
            >I agree to the
            <a routerLink="/terms" target="_blank" class="text-blue-400 hover:text-blue-300"
              >Terms</a
            >
            and
            <a routerLink="/privacy" target="_blank" class="text-blue-400 hover:text-blue-300"
              >Privacy policy</a
            >. MNQ Journal is a journal, not financial advice.</span
          >
        </label>

        <button
          type="submit"
          [disabled]="saving() || !acceptTerms || !name.trim()"
          class="w-full bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ saving() ? 'Creating…' : 'Create my journal' }}
        </button>
        <p class="text-center text-[11px] text-slate-500 mt-4">
          Your email is already confirmed by Google, so there's no link to click.
        </p>
      </form>
    </app-auth-shell>
  `,
})
export class Welcome implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private credential = '';

  email = '';
  name = '';
  acceptTerms = false;
  saving = signal(false);
  errorMessage = signal('');

  ngOnInit() {
    const pending = this.auth.pendingGoogle();
    if (!pending) {
      // Opened directly or after a reload: start again from sign-up
      this.router.navigate(['/register']);
      return;
    }
    this.credential = pending.credential;
    this.email = pending.email;
    this.name = pending.name;
  }

  create() {
    if (this.saving() || !this.acceptTerms || !this.name.trim()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.http
      .post<any>(`${environment.apiUrl}/auth/google`, {
        credential: this.credential,
        acceptTerms: true,
        name: this.name,
      })
      .subscribe({
        next: (response) => {
          this.auth.pendingGoogle.set(null);
          this.auth.signedIn(response.user);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.saving.set(false);
          // Google's token lasts an hour; after that, start over
          this.errorMessage.set(
            err.status === 401
              ? 'That took a while, so Google needs to confirm again. Go back and press Continue with Google.'
              : err.error?.error || 'Something went wrong creating your journal.',
          );
        },
      });
  }
}
