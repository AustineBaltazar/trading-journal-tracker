import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth';
import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    backend = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    component.name = 'Bro';
    component.email = 'bob@gmail.com';
    // The human check is tested through its token
    component.turnstileToken.set('ok');
  });

  it('needs 12+ characters that are not the email', () => {
    component.password = 'short';
    expect(component.canSubmit).toBe(false);
    component.password = 'bob@gmail.com';
    expect(component.longEnough).toBe(true);
    expect(component.canSubmit).toBe(false);
    component.password = 'correct-horse-candle';
    expect(component.canSubmit).toBe(true);
  });

  it('waits for the human check when it is on', () => {
    component.password = 'correct-horse-candle';
    component.turnstileToken.set(null);
    expect(component.canSubmit).toBe(!component.turnstileOn);
  });

  it('creates the account and goes straight to the dashboard', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.password = 'correct-horse-candle';
    component.onSubmit();
    const req = backend.expectOne(`${environment.apiUrl}/register`);
    expect(req.request.body).toEqual({
      name: 'Bro',
      email: 'bob@gmail.com',
      password: 'correct-horse-candle',
      turnstileToken: 'ok',
    });
    req.flush(
      { user: { id: 9, name: 'Bro', email: 'bob@gmail.com' } },
      { status: 201, statusText: 'Created' },
    );
    expect(TestBed.inject(AuthService).user()?.id).toBe(9);
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('shows the server reason, such as a leaked password', async () => {
    component.password = 'password1234';
    component.onSubmit();
    backend
      .expectOne(`${environment.apiUrl}/register`)
      .flush(
        { error: 'This password has appeared in a data leak.' },
        { status: 400, statusText: 'x' },
      );
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'This password has appeared in a data leak.',
    );
    expect(component.submitting()).toBe(false);
  });
});
