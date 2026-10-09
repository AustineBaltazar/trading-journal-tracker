import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Reports } from './reports';

describe('Reports', () => {
  let http: HttpTestingController;

  async function create(query: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Reports);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    return fixture;
  }

  const trades = [
    { id: 1, trade_date: '2026-08-20', netPnl: 100, outcome: 'win', mistakeIds: [] },
    { id: 2, trade_date: '2026-09-07', netPnl: -40, outcome: 'loss', mistakeIds: [] },
    { id: 3, trade_date: '2026-09-21', netPnl: -1.24, outcome: 'be', mistakeIds: [] },
  ];

  beforeEach(() => localStorage.removeItem('reportsRange'));
  afterEach(() => localStorage.removeItem('reportsRange'));

  it('opens the tab and range from the link, and asks for rule stats in that range', async () => {
    const fixture = await create({
      tab: 'discipline',
      range: 'custom',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    const c = fixture.componentInstance;
    expect(c.tab()).toBe('discipline');
    const rules = http.expectOne((r) => r.url.endsWith('/rule-adherence'));
    expect(rules.request.params.get('from')).toBe('2026-09-01');
    expect(rules.request.params.get('to')).toBe('2026-09-30');
    http.expectOne((r) => r.url.endsWith('/trades')).flush({ trades });
    expect(c.scope()).toMatchObject({
      count: 2,
      first: '2026-09-07',
      last: '2026-09-21',
      net: -41.24,
      breakEvens: 1,
    });
  });

  it('defaults to all time and remembers a new range', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    expect(c.range()).toBe('all');
    const allTime = http.expectOne((r) => r.url.endsWith('/rule-adherence'));
    expect(allTime.request.params.has('from')).toBe(false);
    http.expectOne((r) => r.url.endsWith('/trades')).flush({ trades });
    expect(c.scope().count).toBe(3);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.setRange('30d');
    await fixture.whenStable();
    expect(localStorage.getItem('reportsRange')).toBe('30d');
    expect(navigate.mock.calls.at(-1)?.[1]?.queryParams).toMatchObject({
      tab: 'timing',
      range: '30d',
      from: null,
    });
    expect(
      http.expectOne((r) => r.url.endsWith('/rule-adherence')).request.params.has('from'),
    ).toBe(true);
  });

  it('switching to custom starts from the dates on screen', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    http.expectOne((r) => r.url.endsWith('/trades')).flush({ trades });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.setRange('custom');
    expect(c.custom()).toEqual({ from: '2026-08-20', to: '2026-09-21' });
    expect(c.scope().count).toBe(3);
  });
});
