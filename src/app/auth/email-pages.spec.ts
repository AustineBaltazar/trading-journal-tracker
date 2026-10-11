import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import { takeTokenFromUrl, newPasswordOk } from './auth-ui';
import { CheckEmail } from './check-email';
import { ForgotPassword } from './forgot-password';
import { ResetPassword } from './reset-password';
import { VerifyEmail } from './verify-email';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return TestBed.inject(HttpTestingController);
}

function openWithToken(path: string, token = TOKEN) {
  window.history.replaceState({}, '', `${path}?token=${token}`);
}

afterEach(() => window.history.replaceState({}, '', '/'));

describe('email link helpers', () => {
  it('takes the token out of the address bar', () => {
    openWithToken('/verify-email');
    expect(takeTokenFromUrl()).toBe(TOKEN);
    expect(window.location.search).toBe('');
    expect(takeTokenFromUrl()).toBe('');
  });

  it('new passwords need 12+ characters that are not the email', () => {
    expect(newPasswordOk('short', 'b@x.co')).toBe(false);
    expect(newPasswordOk('bob@gmail.com', 'bob@gmail.com')).toBe(false);
    expect(newPasswordOk('correct-horse-candle', 'bob@gmail.com')).toBe(true);
  });
});

describe('VerifyEmail', () => {
  it('confirms the link, logs in and offers the dashboard', async () => {
    const backend = setup();
    openWithToken('/verify-email');
    const fixture = TestBed.createComponent(VerifyEmail);
    fixture.detectChanges();
    const req = backend.expectOne(`${environment.apiUrl}/verify-email`);
    expect(req.request.body).toEqual({ token: TOKEN });
    expect(window.location.search).toBe('');
    req.flush({ user: { id: 9, name: 'Bro', email: 'bob@gmail.com' } });
    await fixture.whenStable();
    expect(TestBed.inject(AuthService).user()?.id).toBe(9);
    expect(text(fixture.nativeElement)).toContain("You're in");
  });

  it('a used or expired link offers a new one', async () => {
    const backend = setup();
    openWithToken('/verify-email');
    const fixture = TestBed.createComponent(VerifyEmail);
    fixture.detectChanges();
    backend
      .expectOne(`${environment.apiUrl}/verify-email`)
      .flush({ expired: true }, { status: 400, statusText: 'x' });
    await fixture.whenStable();
    expect(text(fixture.nativeElement)).toContain('This link has expired');
    expect(text(fixture.nativeElement)).toContain('Send a new link');
  });
});

describe('CheckEmail', () => {
  it('names the address and lets you resend after a minute', async () => {
    vi.useFakeTimers();
    const backend = setup();
    TestBed.inject(AuthService).pendingEmail.set('bob@gmail.com');
    const fixture = TestBed.createComponent(CheckEmail);
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toContain('If bob@gmail.com is new here');
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    fixture.componentInstance.resend();
    const req = backend.expectOne(`${environment.apiUrl}/resend-verification`);
    expect(req.request.body).toEqual({ email: 'bob@gmail.com' });
    req.flush({ message: 'Check your email.' }, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toContain('Sent again');
    fixture.destroy();
    vi.useRealTimers();
  });
});

describe('ForgotPassword', () => {
  it('always shows the same "on its way" message', async () => {
    const backend = setup();
    const fixture = TestBed.createComponent(ForgotPassword);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.email = 'bob@gmail.com';
    page.turnstileToken.set('ok');
    page.send();
    const req = backend.expectOne(`${environment.apiUrl}/forgot-password`);
    expect(req.request.body.email).toBe('bob@gmail.com');
    req.flush({ message: 'Check your email.' }, { status: 202, statusText: 'Accepted' });
    await fixture.whenStable();
    expect(text(fixture.nativeElement)).toContain(
      'If that email has an account, a reset link is on its way',
    );
  });
});

describe('ResetPassword', () => {
  async function open() {
    const backend = setup();
    openWithToken('/reset-password');
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    backend
      .expectOne(`${environment.apiUrl}/reset-password/check`)
      .flush({ email: 'bob@gmail.com' });
    await fixture.whenStable();
    return { backend, fixture, page: fixture.componentInstance };
  }

  it('shows the account, then saves, logs in and opens trades', async () => {
    const { backend, fixture, page } = await open();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(text(fixture.nativeElement)).toContain('For bob@gmail.com');
    expect(page.logoutOthers).toBe(true);
    page.password = 'short';
    expect(page.canSave).toBe(false);
    page.password = 'violet-kettle-moonrise';
    page.save();
    const req = backend.expectOne(`${environment.apiUrl}/reset-password`);
    expect(req.request.body).toEqual({
      token: TOKEN,
      password: 'violet-kettle-moonrise',
      logoutOthers: true,
    });
    req.flush({ user: { id: 9, name: 'Bro', email: 'bob@gmail.com' } });
    expect(TestBed.inject(AuthService).user()?.id).toBe(9);
    expect(navigate).toHaveBeenCalledWith(['/trades']);
  });

  it('shows the server reason, like a leaked password', async () => {
    const { backend, fixture, page } = await open();
    page.password = 'password123456';
    page.save();
    backend
      .expectOne(`${environment.apiUrl}/reset-password`)
      .flush(
        { error: 'This password has appeared in a data leak.' },
        { status: 400, statusText: 'x' },
      );
    await fixture.whenStable();
    expect(text(fixture.nativeElement)).toContain('appeared in a data leak');
  });

  it('a dead link says so before any typing', async () => {
    const backend = setup();
    openWithToken('/reset-password');
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    backend
      .expectOne(`${environment.apiUrl}/reset-password/check`)
      .flush({ expired: true }, { status: 400, statusText: 'x' });
    await fixture.whenStable();
    expect(text(fixture.nativeElement)).toContain('This link has expired');
  });
});
