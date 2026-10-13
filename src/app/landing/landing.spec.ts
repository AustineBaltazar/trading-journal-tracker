import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';
import { Start } from './start';
import { routes } from '../app.routes';
import { BRAND } from '../brand';
import { ThemeService } from '../theme';

describe('public pages', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('the homepage uses the app name from brand.ts and points to sign-up', async () => {
    const fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain(`${BRAND.name} turns them into plain answers`);
    expect(el.textContent).toContain(BRAND.first);
    const signUp = [...el.querySelectorAll('a')].filter(
      (a) => a.getAttribute('href') === '/register',
    );
    expect(signUp.length).toBeGreaterThanOrEqual(2);
    expect(el.querySelectorAll('dt').length).toBe(4); // FAQ
  });

  it('screenshots follow the light/dark theme', async () => {
    TestBed.inject(ThemeService).set('light');
    const fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('landing/dashboard-light.png');
    TestBed.inject(ThemeService).set('system');
  });

  it('/start has the real sign-up form inside the page, not in the login card', async () => {
    const fixture = TestBed.createComponent(Start);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-register form')).not.toBeNull();
    expect(el.querySelector('app-auth-shell')).toBeNull();
    expect(el.textContent).toContain('Create your account');
  });

  it('/ and /start are public pages; logged-in visitors are sent on', () => {
    const home = routes.find((r) => r.path === '' && r.pathMatch === 'full')!;
    const start = routes.find((r) => r.path === 'start')!;
    expect(home.canActivate?.length).toBe(1);
    expect(start.canActivate?.length).toBe(1);
    expect(routes.some((r) => r.redirectTo === '/login')).toBe(false);
  });
});
