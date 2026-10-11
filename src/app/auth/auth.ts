import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

// Who is logged in. The session itself lives in an HttpOnly cookie the page can't read,
// so the server is asked (GET /me) once per page load.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  readonly user = signal<AuthUser | null>(null);
  // The address a link was just sent to, for the "check your email" page
  readonly pendingEmail = signal('');

  constructor() {
    // Left over from before the cookie switch
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
  }

  ensureUser(): Observable<boolean> {
    if (this.user()) return of(true);
    return this.http.get<{ user: AuthUser }>(`${environment.apiUrl}/me`).pipe(
      map((response) => {
        this.user.set(response.user);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  signedIn(user: AuthUser) {
    this.user.set(user);
  }

  // The session ended on the server (logged out elsewhere, or expired)
  expired() {
    this.user.set(null);
  }

  logout(): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/logout`, {}).pipe(
      catchError(() => of(null)),
      tap(() => this.user.set(null)),
    );
  }
}

// Answers from these are about the form itself, never "your session ended"
const AUTH_PATHS =
  /\/(me|login|register|logout|verify-email|resend-verification|forgot-password|reset-password(\/check)?)$/;

// Sends the session cookie with API calls (needed in dev, where the API is on another port),
// and goes to the login page when the session has ended.
// Other hosts (the signed S3 upload URLs) never get the cookie.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req.clone({ withCredentials: true })).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !AUTH_PATHS.test(req.url)) {
        auth.expired();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureUser()
    .pipe(map((ok) => ok || router.createUrlTree(['/login'])));
};

// Login and sign-up skip straight to the app when already logged in
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureUser()
    .pipe(map((ok) => (ok ? router.createUrlTree(['/trades']) : true)));
};

export interface PasswordStrength {
  score: number; // 0-4, one bar each
  label: string;
}

// A rough guide for the meter; the server enforces the real rules
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 12) {
    return { score: password ? 1 : 0, label: password ? 'Too short' : '' };
  }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(password)).length;
  let score = 2;
  if (password.length >= 16 || kinds >= 3) score += 1;
  if (password.length >= 20 || (password.length >= 16 && kinds >= 3)) score += 1;
  return { score, label: ['', '', 'Okay', 'Good', 'Strong'][score] };
}

export function sameAsEmail(password: string, email: string) {
  const lower = password.toLowerCase();
  const address = email.trim().toLowerCase();
  const localPart = address.split('@')[0];
  return !!password && (lower === address || (localPart.length >= 4 && lower === localPart));
}

// m:ss for the lockout countdown
export function formatWait(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
