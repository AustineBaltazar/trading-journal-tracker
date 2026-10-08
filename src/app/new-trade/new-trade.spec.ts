import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NewTrade } from './new-trade';
import { TradeModeService } from '../trade-mode';

describe('NewTrade', () => {
  let component: NewTrade;
  let fixture: ComponentFixture<NewTrade>;
  let http: HttpTestingController;

  const rules = [
    { id: 1, name: 'IFVG' },
    { id: 2, name: 'SMT' },
  ];

  async function create() {
    fixture = TestBed.createComponent(NewTrade);
    component = fixture.componentInstance;
    await fixture.whenStable();
    http.expectOne((r) => r.url.endsWith('/rules')).flush({ rules });
    http
      .expectOne((r) => r.url.endsWith('/mistakes'))
      .flush({
        mistakes: [
          { id: 7, name: 'Moved my stop' },
          { id: 8, name: 'Oversized the position' },
        ],
      });
  }

  // Answers the trade POST and the two rule links
  function completeSave() {
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/trades'));
    const body = post.request.body;
    post.flush({ id: 99, ...body });
    http.match((r) => r.url.endsWith('/trade-rules')).forEach((r) => r.flush({}));
    http.match((r) => r.url.endsWith('/trades/99/mistakes')).forEach((r) => r.flush({}));
    return body;
  }

  beforeEach(async () => {
    localStorage.removeItem('tradeMode');
    await TestBed.configureTestingModule({
      imports: [NewTrade],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.removeItem('tradeMode'));

  it('should create', async () => {
    await create();
    expect(component).toBeTruthy();
  });

  it('starts in the app mode and sends it with the trade', async () => {
    TestBed.inject(TradeModeService).set('backtest');
    await create();
    expect(component.mode).toBe('backtest');

    const saved = vi.fn();
    component.saved.subscribe(saved);
    component.onSubmit();
    expect(completeSave().mode).toBe('backtest');
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('"Save and add another" keeps the setup and clears the trade', async () => {
    await create();
    Object.assign(component, {
      trade_date: '2024-03-14',
      symbol: 'NQ',
      strategy: 'IFVG reclaim',
      session: 'New York AM',
      direction: 'short',
      contracts: 3,
      entry_price: 18000,
      exit_price: 17950,
      entry_time: '09:35',
      exit_time: '09:58',
      emotion: 'Calm',
      grade: 'A',
      notes: 'clean sweep',
      screenshot_link: 'https://example.com/x',
    });
    component.checkedRuleIds.set(new Set([1]));

    const saved = vi.fn();
    const added = vi.fn();
    component.saved.subscribe(saved);
    component.added.subscribe(added);

    component.onSubmit(true);
    completeSave();

    expect(added).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
    expect(component.loggedCount()).toBe(1);
    expect(component).toMatchObject({
      trade_date: '2024-03-14',
      symbol: 'NQ',
      strategy: 'IFVG reclaim',
      session: 'New York AM',
      direction: 'short',
      contracts: 3,
      entry_price: 0,
      exit_price: 0,
      entry_time: '',
      exit_time: '',
      emotion: '',
      grade: '',
      notes: '',
      screenshot_link: '',
    });
    expect([...component.checkedRuleIds()]).toEqual([1, 2]);
  });

  it('saves the tagged mistakes and clears them for the next trade', async () => {
    await create();
    component.toggleMistake(7);
    component.toggleMistake(8);
    component.toggleMistake(8);
    const added = vi.fn();
    component.added.subscribe(added);

    component.onSubmit(true);
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/trades'));
    post.flush({ id: 99, ...post.request.body });
    http.match((r) => r.url.endsWith('/trade-rules')).forEach((r) => r.flush({}));
    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/trades/99/mistakes'));
    expect(put.request.body).toEqual({ mistake_ids: [7] });
    expect(added).not.toHaveBeenCalled(); // waits for the mistakes save too
    put.flush({});

    expect(added).toHaveBeenCalledTimes(1);
    expect(component.selectedMistakeIds().size).toBe(0);
  });

  it('skips the mistakes request for a clean trade', async () => {
    await create();
    component.onSubmit();
    completeSave();
    http.expectNone((r) => r.url.endsWith('/mistakes') && r.method === 'PUT');
  });

  it('ignores a second submit while the first is still saving', async () => {
    await create();
    component.onSubmit(true);
    component.onSubmit(true);
    expect(http.match((r) => r.method === 'POST' && r.url.endsWith('/trades')).length).toBe(1);
  });
});
