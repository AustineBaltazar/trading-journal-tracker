import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let backend: HttpTestingController;
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    backend = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    component.email = 'bob@gmail.com';
    component.password = 'nope';
  });

  afterEach(() => vi.useRealTimers());

  it('logs in, remembers the user and keeps no token', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.onSubmit();
    const req = backend.expectOne(`${environment.apiUrl}/login`);
    expect(req.request.body).toMatchObject({ email: 'bob@gmail.com', remember: true });
    req.flush({ user: { id: 7, name: 'Bro', email: 'bob@gmail.com' }, token: 'legacy' });
    expect(TestBed.inject(AuthService).user()?.name).toBe('Bro');
    expect(localStorage.getItem('token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/trades']);
  });

  it('shows the tries left once they get low', async () => {
    component.onSubmit();
    backend
      .expectOne(`${environment.apiUrl}/login`)
      .flush(
        { error: 'Email or password is wrong.', attemptsLeft: 2 },
        { status: 401, statusText: 'x' },
      );
    await fixture.whenStable();
    expect(text()).toContain('Email or password is wrong. 2 tries left before a short wait.');
  });

  it('counts down a lockout and blocks the button', () => {
    vi.useFakeTimers();
    component.onSubmit();
    backend
      .expectOne(`${environment.apiUrl}/login`)
      .flush({ error: 'Too many attempts.', retryAfter: 292 }, { status: 429, statusText: 'x' });
    fixture.detectChanges();
    expect(text()).toContain('Try again in 4:52');
    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(text()).toContain('Try again in 4:50');
    expect(
      (fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).disabled,
    ).toBe(true);
    component.onSubmit();
    backend.expectNone(`${environment.apiUrl}/login`);
  });

  it('an unconfirmed email can ask for a new link', async () => {
    component.password = 'correct-horse-candle';
    component.onSubmit();
    backend
      .expectOne(`${environment.apiUrl}/login`)
      .flush(
        { error: 'Please confirm your email first.', unverified: true },
        { status: 403, statusText: 'x' },
      );
    await fixture.whenStable();
    expect(text()).toContain('Please confirm your email first.');
    component.resendLink();
    expect(backend.expectOne(`${environment.apiUrl}/resend-verification`).request.body).toEqual({
      email: 'bob@gmail.com',
    });
  });

  it('links to forgot password', () => {
    const link = fixture.nativeElement.querySelector('a[href="/forgot-password"]');
    expect(link?.textContent).toContain('Forgot password?');
  });

  it('the password can be shown', async () => {
    const input = fixture.nativeElement.querySelector('#login-password') as HTMLInputElement;
    expect(input.type).toBe('password');
    component.showPassword.set(true);
    await fixture.whenStable();
    expect(input.type).toBe('text');
  });
});
