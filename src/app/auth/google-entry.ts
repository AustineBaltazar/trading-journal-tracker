import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth';
import { GoogleButton, googleOn } from './google-button';

// "Continue with Google" at the top of the login and sign-up cards, with the
// "or use your email" divider. Handles where to go next.
@Component({
  selector: 'app-google-entry',
  imports: [GoogleButton],
  template: `
    @if (on) {
      @if (error()) {
        <p
          role="alert"
          class="text-xs text-amber-100 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-3"
        >
          {{ error() }}
        </p>
      }
      <app-google-button
        [text]="text()"
        (credential)="signIn($event)"
        (failed)="error.set('Google sign-in could not load. Use your email below.')"
      />
      <div class="flex items-center gap-3 my-4 text-[11px] text-slate-500" aria-hidden="true">
        <span class="flex-1 h-px bg-[#1F293D]"></span>or use your email<span
          class="flex-1 h-px bg-[#1F293D]"
        ></span>
      </div>
    }
  `,
})
export class GoogleEntry {
  private auth = inject(AuthService);
  private router = inject(Router);
  text = input<'continue_with' | 'signup_with' | 'signin_with'>('continue_with');
  error = signal('');
  readonly on = googleOn();

  signIn(credential: string) {
    this.error.set('');
    this.auth.googleSignIn(credential).subscribe({
      next: (result) => {
        if (result.outcome === 'in') this.router.navigate(['/trades']);
        else if (result.outcome === 'signup') this.router.navigate(['/welcome']);
        else this.error.set(result.error);
      },
      error: (err) =>
        this.error.set(err.error?.error || 'Google sign-in did not work. Please try again.'),
    });
  }
}
