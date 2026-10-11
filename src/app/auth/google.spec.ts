import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import { googleOn } from './google-button';
import { Welcome } from './welcome';

const api = environment.apiUrl;

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return {
    auth: TestBed.inject(AuthService),
    backend: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

describe('Continue with Google', () => {
  it('is hidden until a Google client ID is set', () => {
    expect(googleOn()).toBe(Boolean(environment.googleClientId));
  });

  it('a connected account is signed in', () => {
    const { auth, backend } = setup();
    let outcome: any;
    auth.googleSignIn('token').subscribe((r) => (outcome = r));
    const req = backend.expectOne(`${api}/auth/google`);
    expect(req.request.body).toEqual({ credential: 'token' });
    req.flush({ user: { id: 7, name: 'Bro', email: 'bob@gmail.com' } });
    expect(outcome.outcome).toBe('in');
    expect(auth.user()?.id).toBe(7);
  });

  it('a new Google user goes to the welcome step, keeping the token', () => {
    const { auth, backend } = setup();
    let outcome: any;
    auth.googleSignIn('token').subscribe((r) => (outcome = r));
    backend
      .expectOne(`${api}/auth/google`)
      .flush({ needsSignup: true, email: 'new@gmail.com', name: 'New Person' });
    expect(outcome.outcome).toBe('signup');
    expect(auth.user()).toBeNull();
    expect(auth.pendingGoogle()).toEqual({
      credential: 'token',
      email: 'new@gmail.com',
      name: 'New Person',
    });
  });

  it('an email with a password account says to connect from the Account page', () => {
    const { auth, backend } = setup();
    let outcome: any;
    auth.googleSignIn('token').subscribe((r) => (outcome = r));
    backend
      .expectOne(`${api}/auth/google`)
      .flush(
        { error: 'You already have an account…', linkRequired: true },
        { status: 409, statusText: 'x' },
      );
    expect(outcome).toEqual({ outcome: 'link', error: 'You already have an account…' });
    expect(auth.user()).toBeNull();
  });
});

describe('Welcome', () => {
  it('without a pending Google sign-in, goes back to sign-up', () => {
    const { router } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    TestBed.createComponent(Welcome).detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/register']);
  });

  it('needs the Terms, then creates the journal and opens the dashboard', async () => {
    const { auth, backend, router } = setup();
    auth.pendingGoogle.set({ credential: 'token', email: 'new@gmail.com', name: 'New Person' });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Welcome);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('new@gmail.com');
    page.create();
    backend.expectNone(`${api}/auth/google`);
    page.acceptTerms = true;
    page.name = 'Andrei';
    page.create();
    const req = backend.expectOne(`${api}/auth/google`);
    expect(req.request.body).toEqual({ credential: 'token', acceptTerms: true, name: 'Andrei' });
    req.flush(
      { user: { id: 50, name: 'Andrei', email: 'new@gmail.com' } },
      { status: 201, statusText: 'Created' },
    );
    expect(auth.user()?.id).toBe(50);
    expect(auth.pendingGoogle()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('an expired Google token asks to start again', async () => {
    const { auth, backend } = setup();
    auth.pendingGoogle.set({ credential: 'old', email: 'new@gmail.com', name: 'N' });
    const fixture = TestBed.createComponent(Welcome);
    fixture.detectChanges();
    fixture.componentInstance.acceptTerms = true;
    fixture.componentInstance.create();
    backend.expectOne(`${api}/auth/google`).flush({}, { status: 401, statusText: 'x' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Google needs to confirm again');
  });
});
