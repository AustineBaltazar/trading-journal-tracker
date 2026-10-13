import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { highlight, money, SearchResult, shortDate } from './search';
import { SearchPalette } from './search-palette';
import { SearchPage } from './search-page';

const result = (q = 'tired'): SearchResult => ({
  q,
  trades: [
    {
      type: 'trade',
      id: 41,
      date: '2026-09-19',
      time: '10:00',
      direction: 'short',
      netPnl: -288.96,
      outcome: 'loss',
      field: 'Notes',
      snippet: 'Was tired after a bad night',
    },
  ],
  journal: [
    {
      type: 'journal',
      date: '2026-09-20',
      field: 'Lesson',
      snippet: 'Tired + FOMO = bad entries',
      dayNet: null,
    },
  ],
  counts: { trades: 1, journal: 1 },
  stats: {
    matched: { totalTrades: 1, totalPnl: -288.96, wins: 0, losses: 1, breakEvens: 0, winRate: 0 },
    overall: {
      totalTrades: 50,
      totalPnl: 5150.74,
      wins: 30,
      losses: 16,
      breakEvens: 4,
      winRate: 65,
    },
  },
});

describe('search helpers', () => {
  it('marks every match, ignoring case', () => {
    expect(highlight('Tired? So tired.', 'tired')).toEqual([
      { text: 'Tired', hit: true },
      { text: '? So ', hit: false },
      { text: 'tired', hit: true },
      { text: '.', hit: false },
    ]);
    expect(highlight('nothing', '')).toEqual([{ text: 'nothing', hit: false }]);
  });

  it('formats dates and money', () => {
    expect(shortDate('2026-09-19')).toBe('Sat, Sep 19');
    expect(money(-288.96)).toBe('−$288.96');
    expect(money(96.5)).toBe('+$96.50');
  });
});

describe('SearchPalette', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('opens with Ctrl+K, searches as you type, and Enter opens the first result', async () => {
    const fixture = TestBed.createComponent(SearchPalette);
    const c = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(c.open()).toBe(true);

    c.onType('t');
    vi.advanceTimersByTime(250);
    http.expectNone((r) => r.url.endsWith('/search')); // too short

    c.onType('tired');
    vi.advanceTimersByTime(250);
    const req = http.expectOne((r) => r.url.endsWith('/search'));
    expect(req.request.params.get('q')).toBe('tired');
    expect(req.request.params.get('mode')).toBe('live');
    req.flush(result());

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.onKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    c.onKey(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // wraps back to the first
    c.onKey(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navigate).toHaveBeenCalledWith(['/trades', 41]);
    expect(c.open()).toBe(false);
  });

  it('a journal result opens that day, and See all opens the Search page', () => {
    const c = TestBed.createComponent(SearchPalette).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.openHit(result().journal[0]);
    expect(navigate).toHaveBeenCalledWith(['/journal'], { queryParams: { date: '2026-09-20' } });
    c.query.set(' tired ');
    c.seeAll();
    expect(navigate).toHaveBeenLastCalledWith(['/search'], { queryParams: { q: 'tired' } });
  });
});

describe('SearchPage', () => {
  async function open(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'search', component: SearchPage }]),
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(SearchPage);
    await fixture.whenStable();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('searches the word in the URL and shows how those trades went', async () => {
    const { fixture, http } = await open('/search?q=tired&range=30d');
    const req = http.expectOne((r) => r.url.endsWith('/search'));
    expect(req.request.params.get('q')).toBe('tired');
    expect(req.request.params.has('from')).toBe(true);
    req.flush(result());
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Trades that mention tired');
    expect(text).toContain('0% vs 65% overall');
    expect(text).toContain('−$288.96');
    expect(fixture.componentInstance.rows().map((r) => r.type)).toEqual(['journal', 'trade']);
  });

  it('the Journal chip shows only journal days', async () => {
    const { fixture, http } = await open('/search?q=tired&show=journal');
    http.expectOne((r) => r.url.endsWith('/search')).flush(result());
    await fixture.whenStable();
    expect(fixture.componentInstance.rows().map((r) => r.type)).toEqual(['journal']);
    expect(fixture.nativeElement.textContent).not.toContain('Trades that mention');
  });
});
