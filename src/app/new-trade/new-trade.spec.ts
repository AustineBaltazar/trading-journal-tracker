import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NewTrade } from './new-trade';
import { TradeModeService } from '../trade-mode';

// Node 22 (CI) cannot make object URLs for jsdom Files; previews only need a string
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

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
      .expectOne((r) => r.url.endsWith('/tag-groups'))
      .flush({ groups: [{ id: 1, name: 'Setup', tags: [{ id: 5, name: 'IFVG' }] }] });
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

  it('sends stop and target, shows R, and saves tags', async () => {
    await create();
    Object.assign(component, {
      direction: 'short',
      contracts: 4,
      entry_price: 21085.25,
      exit_price: 21028.75,
      fees: 4.96,
    });
    component.stop_price = 21105.25;
    component.target_price = '';
    expect(component.rPreview).toEqual({ rMultiple: 2.83, plannedR: null, riskPoints: 20 });
    expect(component.riskDollars).toBe(160);
    component.toggleTag(5);
    component.onSubmit();
    expect(completeSave()).toMatchObject({ stop_price: 21105.25, target_price: null });
    const tags = http.expectOne((r) => r.url.endsWith('/trades/99/tags'));
    expect(tags.request.body).toEqual({ tag_ids: [5] });
    tags.flush({});
  });

  it('blocks a stop on the wrong side before saving', async () => {
    await create();
    Object.assign(component, {
      direction: 'long',
      entry_price: 21000,
      exit_price: 21010,
      stop_price: 21005,
    });
    component.onSubmit();
    expect(component.errorMessage()).toBe('The stop for a long goes below the entry.');
    http.expectNone((r) => r.method === 'POST');
  });

  it('sends the emotions and the picked result (null = auto)', async () => {
    await create();
    component.toggleEmotion('FOMO');
    component.toggleEmotion('Anxious');
    component.entry_price = 21466.5;
    component.exit_price = 21466.5;
    component.fees = 1.24;
    expect(component.autoResult).toBe('be');
    component.onSubmit();
    expect(completeSave()).toMatchObject({ emotions: ['Anxious', 'FOMO'], result: null });

    component.setResult('loss');
    component.onSubmit();
    expect(completeSave().result).toBe('loss');
  });

  it('uploads queued screenshots once the trade exists, then closes', async () => {
    await create();
    fixture.detectChanges();
    const saved = vi.fn();
    component.saved.subscribe(saved);
    const gallery = (component as any).gallery();
    gallery.addFiles([new File([new Uint8Array(8)], 'entry.png', { type: 'image/png' })]);
    http.expectNone((r) => r.url.includes('/images'));

    component.onSubmit();
    completeSave();
    expect(saved).not.toHaveBeenCalled();
    http
      .expectOne((r) => r.url.endsWith('/trades/99/images/upload-url'))
      .flush({ key: 'users/1/trades/99/a.png', uploadUrl: 'https://s3.example.test/a' });
    http.expectOne('https://s3.example.test/a').flush(null);
    http
      .expectOne((r) => r.url.endsWith('/trades/99/images') && r.method === 'POST')
      .flush({ id: 1, caption: null, url: 'https://view' });
    await fixture.whenStable();
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
      emotions: ['Calm', 'Confident'],
      result: 'win',
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
      emotions: [],
      result: null,
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
