import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthService,
  authGuard,
  authInterceptor,
  formatWait,
  passwordStrength,
  sameAsEmail,
} from './auth';

describe('password helpers', () => {
  it('rates passwords for the meter', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: '' });
    expect(passwordStrength('short')).toEqual({ score: 1, label: 'Too short' });
    expect(passwordStrength('abcdefghijkl').label).toBe('Okay');
    expect(passwordStrength('abcdefghijklmnop').label).toBe('Good');
    expect(passwordStrength('correct-Horse-candle-9').label).toBe('Strong');
  });

  it('spots a password that is just the email', () => {
    expect(sameAsEmail('Bob@Gmail.com', ' bob@gmail.com ')).toBe(true);
    expect(sameAsEmail('bobbybobbybob', 'bobbybobbybob@gmail.com')).toBe(true);
    expect(sameAsEmail('correct-horse-candle', 'bob@gmail.com')).toBe(false);
    expect(sameAsEmail('', 'bob@gmail.com')).toBe(false);
  });

  it('formats the lockout wait', () => {
    expect(formatWait(292)).toBe('4:52');
    expect(formatWait(5)).toBe('0:05');
    expect(formatWait(-3)).toBe('0:00');
  });
});

describe('auth wiring', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('token', 'old-jwt');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  it('removes the old localStorage token', () => {
    TestBed.inject(AuthService);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('sends the cookie to the API only, never to S3', () => {
    http.get(`${environment.apiUrl}/trades`).subscribe();
    http.put('https://bucket.s3.amazonaws.com/x?sig=1', new Blob()).subscribe();
    expect(backend.expectOne(`${environment.apiUrl}/trades`).request.withCredentials).toBe(true);
    expect(
      backend.expectOne((r) => r.url.startsWith('https://bucket')).request.withCredentials,
    ).toBe(false);
  });

  it('an ended session sends you to the login page', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const auth = TestBed.inject(AuthService);
    auth.signedIn({ id: 7, name: 'Bro', email: 'bob@gmail.com' });
    http.get(`${environment.apiUrl}/trades`).subscribe({ error: () => {} });
    backend
      .expectOne(`${environment.apiUrl}/trades`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('a wrong password on the login form does not redirect', () => {
    const navigate = vi.spyOn(router, 'navigate');
    http.post(`${environment.apiUrl}/login`, {}).subscribe({ error: () => {} });
    backend
      .expectOne(`${environment.apiUrl}/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('the guard asks the server once, then remembers the user', async () => {
    const guard = () => TestBed.runInInjectionContext(() => authGuard({} as any, {} as any)) as any;
    const first = firstValueFrom(guard());
    backend
      .expectOne(`${environment.apiUrl}/me`)
      .flush({ user: { id: 7, name: 'Bro', email: 'b@x.co' } });
    expect(await first).toBe(true);
    expect(await firstValueFrom(guard())).toBe(true);
    backend.expectNone(`${environment.apiUrl}/me`);
  });

  it('the guard sends a logged-out visitor to /login', async () => {
    const guard = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any)) as any;
    const result = firstValueFrom(guard);
    backend
      .expectOne(`${environment.apiUrl}/me`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(router.serializeUrl((await result) as UrlTree)).toBe('/login');
  });
});
