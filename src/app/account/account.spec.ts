import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth';
import { Account, formatBytes, lastSeen } from './account';

const api = environment.apiUrl;
const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

describe('account helpers', () => {
  it('describes when a device was last used', () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(lastSeen('2026-10-11T11:55:00Z', now)).toBe('Active now');
    expect(lastSeen('2026-10-11T11:30:00Z', now)).toBe('30 minutes ago');
    expect(lastSeen('2026-10-11T10:00:00Z', now)).toBe('2 hours ago');
    expect(lastSeen('2026-10-02T08:00:00Z', now)).toBe('Oct 2');
  });

  it('formats storage sizes', () => {
    expect(formatBytes(512 * 1024)).toBe('512 KB');
    expect(formatBytes(3.4 * 1024 * 1024)).toBe('3.4 MB');
    expect(formatBytes(200 * 1024 * 1024)).toBe('200 MB');
  });
});

describe('Account page', () => {
  let fixture: ComponentFixture<Account>;
  let page: Account;
  let backend: HttpTestingController;

  async function load(demo = false) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Account);
    page = fixture.componentInstance;
    fixture.detectChanges();
    backend.expectOne(`${api}/account`).flush({
      user: { id: 7, name: 'Bro', email: 'bob@gmail.com', demo },
      emailConfirmed: true,
      createdAt: '2026-10-01T00:00:00Z',
      storage: { usedBytes: 50 * 1024 * 1024, limitBytes: 200 * 1024 * 1024 },
    });
    backend.expectOne(`${api}/account/sessions`).flush({
      sessions: [
        {
          id: 3,
          device: 'Chrome on Windows',
          ip: '203.0.113.x',
          createdAt: '',
          lastSeenAt: new Date().toISOString(),
          current: true,
        },
        {
          id: 9,
          device: 'Safari on iPhone',
          ip: '198.51.100.x',
          createdAt: '',
          lastSeenAt: '2026-10-02T08:00:00Z',
          current: false,
        },
      ],
    });
    backend.expectOne(`${api}/account/login-history`).flush({
      attempts: [
        { succeeded: false, device: 'Unknown browser', ip: null, at: '2026-10-09T03:41:00Z' },
      ],
    });
    await fixture.whenStable();
  }

  it('shows the profile, devices, history and storage', async () => {
    await load();
    const t = text(fixture.nativeElement);
    expect(t).toContain('bob@gmail.com');
    expect(t).toContain('Confirmed');
    expect(t).toContain('Safari on iPhone');
    expect(t).toContain('Wrong password');
    expect(t).toContain('50 MB of 200 MB');
    expect(page.storagePercent()).toBe(25);
    const csv = fixture.nativeElement.querySelector('a[download]') as HTMLAnchorElement;
    expect(csv.getAttribute('href')).toBe(`${api}/account/export/trades.csv`);
  });

  it('logs out another device', async () => {
    await load();
    page.logOutDevice(page.devices()[1]);
    backend
      .expectOne((r) => r.method === 'DELETE' && r.url === `${api}/account/sessions/9`)
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(page.devices().map((d) => d.id)).toEqual([3]);
  });

  it('changes the password once the rules pass', async () => {
    await load();
    page.currentPassword = 'old-password-123';
    page.newPassword = 'short';
    expect(page.canChangePassword).toBe(false);
    page.newPassword = 'violet-kettle-moonrise';
    page.changePassword();
    const req = backend.expectOne(`${api}/account/password`);
    expect(req.request.body).toEqual({
      currentPassword: 'old-password-123',
      newPassword: 'violet-kettle-moonrise',
    });
    req.flush({ ok: true });
    backend.expectOne(`${api}/account/sessions`).flush({ sessions: [] });
    expect(page.passwordNote()).toContain('other devices were logged out');
    expect(page.currentPassword).toBe('');
  });

  it('delete needs DELETE typed and the password, then leaves', async () => {
    await load();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.deletePassword = 'old-password-123';
    page.deleteConfirm = 'delete';
    expect(page.canDelete).toBe(false);
    page.deleteConfirm = 'DELETE';
    page.deleteAccount();
    const req = backend.expectOne((r) => r.method === 'DELETE' && r.url === `${api}/account`);
    expect(req.request.body).toEqual({ password: 'old-password-123', confirm: 'DELETE' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(TestBed.inject(AuthService).user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('the demo account sees everything switched off', async () => {
    await load(true);
    expect(text(fixture.nativeElement)).toContain('shared demo account');
    page.currentPassword = 'x';
    page.newPassword = 'violet-kettle-moonrise';
    expect(page.canChangePassword).toBe(false);
    page.deleteConfirm = 'DELETE';
    page.deletePassword = 'x';
    expect(page.canDelete).toBe(false);
  });
});
