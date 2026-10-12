import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth';
import { PasswordStrength, newPasswordOk } from '../auth/auth-ui';
import { GoogleButton, googleOn } from '../auth/google-button';
import { ThemeSwitch } from '../theme-switch';

interface Device {
  id: number;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

interface Attempt {
  succeeded: boolean;
  device: string;
  ip: string | null;
  at: string;
}

// "Active now", "2 hours ago", "Oct 2"
export function lastSeen(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 10) return 'Active now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

@Component({
  selector: 'app-account',
  imports: [FormsModule, RouterLink, DatePipe, PasswordStrength, GoogleButton, ThemeSwitch],
  templateUrl: './account.html',
})
export class Account implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly api = environment.apiUrl;
  readonly lastSeen = lastSeen;
  readonly formatBytes = formatBytes;

  loaded = signal(false);
  email = signal('');
  emailConfirmed = signal(false);
  createdAt = signal('');
  demo = signal(false);
  storage = signal({ usedBytes: 0, limitBytes: 1 });
  storagePercent = computed(() =>
    Math.min(100, Math.round((this.storage().usedBytes / this.storage().limitBytes) * 100)),
  );
  devices = signal<Device[]>([]);
  attempts = signal<Attempt[]>([]);

  name = '';
  profileNote = signal('');

  currentPassword = '';
  newPassword = '';
  passwordNote = signal('');
  passwordError = signal('');
  changingPassword = signal(false);

  devicesNote = signal('');

  // How this account can sign in. Google-only accounts confirm with Google instead of
  // a password to set a password or delete the account.
  readonly googleOn = googleOn();
  hasPassword = signal(true);
  googleEmail = signal<string | null>(null);
  signInNote = signal('');

  deleteConfirm = '';
  deletePassword = '';
  deleteError = signal('');
  deleting = signal(false);

  get canChangePassword() {
    return (
      !this.demo() &&
      !this.changingPassword() &&
      (!!this.currentPassword || !this.hasPassword()) &&
      newPasswordOk(this.newPassword, this.email())
    );
  }

  get canDelete() {
    return (
      !this.demo() &&
      !this.deleting() &&
      this.deleteConfirm === 'DELETE' &&
      (!!this.deletePassword || !this.hasPassword())
    );
  }

  ngOnInit() {
    this.http.get<any>(`${this.api}/account`).subscribe((r) => {
      this.name = r.user.name;
      this.email.set(r.user.email);
      this.demo.set(!!r.user.demo);
      this.emailConfirmed.set(r.emailConfirmed);
      this.createdAt.set(r.createdAt);
      this.storage.set(r.storage);
      this.hasPassword.set(r.signIn?.password ?? true);
      this.googleEmail.set(r.signIn?.google ?? null);
      this.loaded.set(true);
    });
    this.loadDevices();
    this.http
      .get<{ attempts: Attempt[] }>(`${this.api}/account/login-history`)
      .subscribe((r) => this.attempts.set(r.attempts));
  }

  private loadDevices() {
    this.http
      .get<{ sessions: Device[] }>(`${this.api}/account/sessions`)
      .subscribe((r) => this.devices.set(r.sessions));
  }

  saveName() {
    this.profileNote.set('');
    this.http.put<any>(`${this.api}/account/profile`, { name: this.name }).subscribe({
      next: (r) => {
        this.auth.signedIn({ ...this.auth.user()!, name: r.user.name });
        this.profileNote.set('Saved.');
      },
      error: (err) => this.profileNote.set(err.error?.error || 'Something went wrong.'),
    });
  }

  // googleCredential: a Google-only account setting its first password
  changePassword(googleCredential?: string) {
    if (!this.canChangePassword) return;
    this.changingPassword.set(true);
    this.passwordError.set('');
    this.passwordNote.set('');
    this.http
      .post(`${this.api}/account/password`, {
        currentPassword: this.hasPassword() ? this.currentPassword : undefined,
        newPassword: this.newPassword,
        googleCredential,
      })
      .subscribe({
        next: () => {
          this.changingPassword.set(false);
          this.currentPassword = '';
          this.newPassword = '';
          this.passwordNote.set(
            this.hasPassword()
              ? 'Password changed. Your other devices were logged out.'
              : 'Password set. You can now log in with your email and password too.',
          );
          this.hasPassword.set(true);
          this.loadDevices();
        },
        error: (err) => {
          this.changingPassword.set(false);
          this.passwordError.set(err.error?.error || 'Something went wrong.');
        },
      });
  }

  logOutDevice(device: Device) {
    this.http.delete(`${this.api}/account/sessions/${device.id}`).subscribe({
      next: () => this.devices.update((list) => list.filter((d) => d.id !== device.id)),
      error: (err) => this.devicesNote.set(err.error?.error || 'Something went wrong.'),
    });
  }

  logOutOthers() {
    this.http
      .post<{ loggedOut: number }>(`${this.api}/account/sessions/logout-others`, {})
      .subscribe({
        next: (r) => {
          this.devicesNote.set(
            r.loggedOut
              ? `Logged out ${r.loggedOut} other device${r.loggedOut === 1 ? '' : 's'}.`
              : 'No other devices were logged in.',
          );
          this.devices.update((list) => list.filter((d) => d.current));
        },
        error: (err) => this.devicesNote.set(err.error?.error || 'Something went wrong.'),
      });
  }

  connectGoogle(credential: string) {
    this.signInNote.set('');
    this.http.post<{ google: string }>(`${this.api}/account/google`, { credential }).subscribe({
      next: (r) => {
        this.googleEmail.set(r.google);
        this.signInNote.set('Google connected. You can now use Continue with Google.');
      },
      error: (err) => this.signInNote.set(err.error?.error || 'Something went wrong.'),
    });
  }

  disconnectGoogle() {
    this.signInNote.set('');
    this.http.delete(`${this.api}/account/google`).subscribe({
      next: () => {
        this.googleEmail.set(null);
        this.signInNote.set('Google disconnected. Log in with your email and password.');
      },
      error: (err) => this.signInNote.set(err.error?.error || 'Something went wrong.'),
    });
  }

  // googleCredential: a Google-only account confirming with Google
  deleteAccount(googleCredential?: string) {
    if (!this.canDelete) return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.http
      .delete(`${this.api}/account`, {
        body: {
          password: this.hasPassword() ? this.deletePassword : undefined,
          confirm: this.deleteConfirm,
          googleCredential,
        },
      })
      .subscribe({
        next: () => {
          this.auth.expired();
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.deleting.set(false);
          this.deleteError.set(err.error?.error || 'Something went wrong deleting your account.');
        },
      });
  }
}
