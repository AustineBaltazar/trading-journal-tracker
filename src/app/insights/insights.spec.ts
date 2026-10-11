import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Insights, TOP_COUNT } from './insights';

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

  it('shows the top 5 each side, everything under All, or one group', async () => {
    const { fixture, http } = await open();
    const trades = [];
    let id = 1;
    // 4 losing hours (timing) and 4 losing emotions (behavior), 3 trades each
    for (const [hour, emotion, net] of [
      ['03', 'FOMO', -400],
      ['04', 'Revenge', -300],
      ['05', 'Anxious', -200],
      ['06', 'Hesitant', -100],
    ] as const) {
      for (const day of [1, 2, 3]) {
        trades.push({
          id: id++,
          trade_date: `2026-09-0${day}`,
          entry_time: `${hour}:${String(id).padStart(2, '0')}`,
          netPnl: net / 3,
          outcome: 'loss',
          emotions: [emotion],
        });
      }
    }
    http.expectOne((r) => r.url.endsWith('/trades')).flush({ trades });
    await fixture.whenStable();
    const c = fixture.componentInstance;
    const total = c.patterns().leaks.length;
    expect(TOP_COUNT).toBe(5);
    expect(total).toBeGreaterThan(TOP_COUNT);
    expect(c.shown().leaks).toHaveLength(5);
    expect(c.leakNote()).toBe(`5 of ${total} · costing you money`);

    c.setFilter('all');
    expect(c.shown().leaks).toHaveLength(total);
    expect(c.leakNote()).toBe('costing you money');

    c.setFilter('behavior');
    expect(c.shown().leaks.every((p) => p.group === 'behavior')).toBe(true);
    expect(c.shown().leaks.map((p) => p.category)).toContain('Behavior');
    const chip = c.chips().find((x) => x.key === 'timing')!;
    expect(chip.count).toBe(c.patterns().leaks.filter((p) => p.group === 'timing').length);
    expect(c.chips().find((x) => x.key === 'grades')!.count).toBe(0);
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
