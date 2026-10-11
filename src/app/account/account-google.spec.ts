import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { Account } from './account';

const api = environment.apiUrl;

describe('Account page: Google sign-in', () => {
  let fixture: ComponentFixture<Account>;
  let page: Account;
  let backend: HttpTestingController;

  async function load(signIn: { password: boolean; google: string | null }) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Account);
    page = fixture.componentInstance;
    fixture.detectChanges();
    backend.expectOne(`${api}/account`).flush({
      user: { id: 7, name: 'Bro', email: 'bob@gmail.com', demo: false },
      emailConfirmed: true,
      createdAt: '2026-10-01T00:00:00Z',
      storage: { usedBytes: 0, limitBytes: 200 * 1024 * 1024 },
      signIn,
    });
    backend.expectOne(`${api}/account/sessions`).flush({ sessions: [] });
    backend.expectOne(`${api}/account/login-history`).flush({ attempts: [] });
    await fixture.whenStable();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  it('shows a connected Google account and the password', async () => {
    await load({ password: true, google: 'bob@gmail.com' });
    expect(text()).toContain('Sign-in methods');
    expect(text()).toContain('Connected');
    expect(text()).toContain('Change password');
  });

  it('a Google-only account sets its first password after confirming with Google', async () => {
    await load({ password: false, google: 'bob@gmail.com' });
    expect(text()).toContain('Set a password');
    expect(fixture.nativeElement.querySelector('#acct-current')).toBeNull();
    page.newPassword = 'violet-kettle-moonrise';
    expect(page.canChangePassword).toBe(true);
    page.changePassword('google-token');
    const req = backend.expectOne(`${api}/account/password`);
    expect(req.request.body).toEqual({
      currentPassword: undefined,
      newPassword: 'violet-kettle-moonrise',
      googleCredential: 'google-token',
    });
    req.flush({ ok: true });
    backend.expectOne(`${api}/account/sessions`).flush({ sessions: [] });
    expect(page.hasPassword()).toBe(true);
    expect(page.passwordNote()).toContain('Password set');
  });

  it('can connect and disconnect Google', async () => {
    await load({ password: true, google: null });
    page.connectGoogle('google-token');
    backend.expectOne(`${api}/account/google`).flush({ google: 'bob@gmail.com' });
    expect(page.googleEmail()).toBe('bob@gmail.com');
    page.disconnectGoogle();
    backend
      .expectOne((r) => r.method === 'DELETE' && r.url === `${api}/account/google`)
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(page.googleEmail()).toBeNull();
  });

  it('a Google-only account deletes itself by confirming with Google', async () => {
    await load({ password: false, google: 'bob@gmail.com' });
    page.deleteConfirm = 'DELETE';
    expect(page.canDelete).toBe(true);
    page.deleteAccount('google-token');
    const req = backend.expectOne((r) => r.method === 'DELETE' && r.url === `${api}/account`);
    expect(req.request.body).toEqual({
      password: undefined,
      confirm: 'DELETE',
      googleCredential: 'google-token',
    });
  });
});
