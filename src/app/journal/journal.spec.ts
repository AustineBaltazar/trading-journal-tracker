import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Journal } from './journal';

describe('Journal', () => {
  let http: HttpTestingController;

  async function create(date = '2026-09-23') {
    await TestBed.configureTestingModule({
      imports: [Journal],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    await TestBed.inject(Router).navigate([], { queryParams: { date } });
    const fixture = TestBed.createComponent(Journal);
    await fixture.whenStable();
    http.match((r) => r.url.endsWith('/mistakes')).forEach((r) => r.flush({ mistakes: [] }));
    http
      .match((r) => r.url.endsWith('/trades'))
      .forEach((r) =>
        r.flush({
          trades: [{ id: 1, trade_date: '2026-09-23', netPnl: -289.5, session: 'Asian' }],
        }),
      );
    http.match((r) => r.url.endsWith('/journal')).forEach((r) => r.flush({ entries: [] }));
    const day = http.expectOne((r) => r.url.endsWith(`/journal/${date}`));
    expect(day.request.params.get('mode')).toBe('live');
    day.flush({ entry: { focus: 'No trades outside New York AM.' }, images: [] });
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => vi.useRealTimers());

  it('loads the day and flags trades outside the focus session', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    expect(c.title()).toBe('Wednesday, September 23');
    expect(c.dayTrades().length).toBe(1);
    expect(c.warning()).toContain('Asian session');
  });

  it('auto-saves only the changed fields after a pause', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    vi.useFakeTimers();
    c.set('plan', 'Longs only');
    c.toggle('mood', 'Bored');
    c.toggle('mood', 'Bored'); // clicking again clears it
    expect(http.match((r) => r.method === 'PUT').length).toBe(0);
    expect(c.saveState()).toBe('saving');

    vi.advanceTimersByTime(800);
    const put = http.expectOne((r) => r.method === 'PUT');
    expect(put.request.url).toMatch(/\/journal\/2026-09-23$/);
    expect(put.request.body).toEqual({ plan: 'Longs only', mood: null });
    put.flush({ entry: {} });
    expect(c.saveState()).toBe('saved');
  });

  it('drops key levels without a price when saving', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    c.addLevel();
    c.updateLevel(0, { price: 21466, label: 'IFVG' });
    c.addLevel();
    c.flushSave();
    const put = http.expectOne((r) => r.method === 'PUT');
    expect(put.request.body.key_levels).toEqual([{ price: 21466, label: 'IFVG' }]);
  });

  it('saves pending changes before switching to another day', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    c.set('lesson', 'Close at 11:00');
    await TestBed.inject(Router).navigate([], { queryParams: { date: '2026-09-24' } });
    await fixture.whenStable();
    const put = http.expectOne((r) => r.method === 'PUT');
    expect(put.request.url).toMatch(/\/journal\/2026-09-23$/);
    expect(put.request.body).toEqual({ lesson: 'Close at 11:00' });
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/journal/2026-09-24'));
  });
});
