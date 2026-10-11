import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Insights } from './insights';

describe('Insights', () => {
  beforeEach(() => localStorage.removeItem('insightsRange'));
  afterEach(() => localStorage.removeItem('insightsRange'));

  async function open() {
    TestBed.configureTestingModule({
      imports: [Insights],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(Insights);
    const http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    http.expectOne((r) => r.url.endsWith('/mistakes')).flush({ mistakes: [] });
    http.expectOne((r) => r.url.endsWith('/tag-groups')).flush({ groups: [] });
    http.expectOne((r) => r.url.endsWith('/rule-adherence')).flush({ totalTradesWithRules: 0 });
    return { fixture, http };
  }

  it('shows leaks, edges and records from the trades', async () => {
    const { fixture, http } = await open();
    const trade = (id: number, date: string, net: number, emotion: string) => ({
      id,
      trade_date: date,
      entry_time: '10:00',
      netPnl: net,
      outcome: net > 0 ? 'win' : 'loss',
      emotions: [emotion],
      session: 'New York AM',
    });
    http
      .expectOne((r) => r.url.endsWith('/trades'))
      .flush({
        trades: [
          trade(1, '2026-09-01', -100, 'Revenge'),
          trade(2, '2026-09-02', -100, 'Revenge'),
          trade(3, '2026-09-03', -100, 'Revenge'),
          trade(4, '2026-09-04', 400, 'Calm'),
          trade(5, '2026-09-05', 400, 'Calm'),
          trade(6, '2026-09-06', 400, 'Calm'),
        ],
      });
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Revenge trades cost $300, 0 of 3 won.');
    expect(text).toContain('Calm trades win 100% and make +$1,200.');
    expect(text).toMatch(/Best win streak ?3 Sep 4 – 6/);
    expect(text).toMatch(/Worst loss streak ?3 Sep 1 – 3/);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.open(fixture.componentInstance.patterns().leaks[0]);
    expect(navigate).toHaveBeenCalledWith(['/reports'], {
      queryParams: { tab: 'psychology', range: 'all' },
    });
  });

  it('remembers the range and asks for rule stats in it', async () => {
    const { fixture, http } = await open();
    http.expectOne((r) => r.url.endsWith('/trades')).flush({ trades: [] });
    fixture.componentInstance.setRange('month');
    await fixture.whenStable();
    expect(localStorage.getItem('insightsRange')).toBe('month');
    expect(
      http.expectOne((r) => r.url.endsWith('/rule-adherence')).request.params.has('from'),
    ).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No trades in this range');
  });
});
