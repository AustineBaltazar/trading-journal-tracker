import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { FeedbackButton } from './feedback';

describe('FeedbackButton', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(FeedbackButton);
    fixture.detectChanges();
    return {
      fixture,
      page: fixture.componentInstance,
      backend: TestBed.inject(HttpTestingController),
    };
  }

  it('sends the kind, message and current page', async () => {
    const { fixture, page, backend } = setup();
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/trades/42?tab=review');
    page.show();
    page.kind.set('idea');
    page.message = 'Add a dark/light toggle';
    page.send();
    const req = backend.expectOne(`${environment.apiUrl}/feedback`);
    expect(req.request.body).toEqual({
      kind: 'idea',
      message: 'Add a dark/light toggle',
      page: '/trades/42',
    });
    req.flush({ ok: true }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Thank you!');
  });

  it('can leave the page out, and shows server errors', async () => {
    const { fixture, page, backend } = setup();
    page.show();
    page.includePage = false;
    page.message = 'hi';
    page.send();
    const req = backend.expectOne(`${environment.apiUrl}/feedback`);
    expect(req.request.body.page).toBeUndefined();
    req.flush({ error: "Thanks! You've sent a lot already." }, { status: 429, statusText: 'x' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain("You've sent a lot already");
  });
});
