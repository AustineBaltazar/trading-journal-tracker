import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Journal } from './journal';
import { JournalImages } from './journal-images';

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

describe('JournalImages', () => {
  async function create() {
    await TestBed.configureTestingModule({
      imports: [JournalImages],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(JournalImages);
    fixture.componentRef.setInput('date', '2026-09-23');
    fixture.componentRef.setInput('mode', 'backtest');
    fixture.componentRef.setInput('section', 'pre');
    await fixture.whenStable();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('uploads: signed link, PUT to S3 without auth, then confirm', async () => {
    const { fixture, http } = await create();
    const c = fixture.componentInstance;
    const added: any[] = [];
    c.added.subscribe((img) => added.push(img));
    const file = new File([new Uint8Array(1200)], 'chart.png', { type: 'image/png' });

    c.addFiles([file]);
    const link = http.expectOne((r) => r.url.endsWith('/journal/2026-09-23/images/upload-url'));
    expect(link.request.params.get('mode')).toBe('backtest');
    expect(link.request.body).toEqual({
      section: 'pre',
      content_type: 'image/png',
      size_bytes: 1200,
    });
    link.flush({ key: 'users/1/journal/5/abc.png', uploadUrl: 'https://s3.example.test/signed' });

    const put = http.expectOne('https://s3.example.test/signed');
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.get('Content-Type')).toBe('image/png');
    expect(put.request.headers.has('Authorization')).toBe(false);
    expect(c.uploads().length).toBe(1);
    put.flush(null);

    const confirm = http.expectOne(
      (r) => r.url.endsWith('/journal/2026-09-23/images') && r.method === 'POST',
    );
    expect(confirm.request.body).toEqual({ key: 'users/1/journal/5/abc.png', section: 'pre' });
    confirm.flush({ id: 9, section: 'pre', caption: null, url: 'https://view', createdAt: '' });

    expect(added.map((a) => a.id)).toEqual([9]);
    expect(c.uploads().length).toBe(0);
  });

  it('rejects unsupported files without calling the server', async () => {
    const { fixture, http } = await create();
    const c = fixture.componentInstance;
    c.addFiles([new File(['x'], 'anim.gif', { type: 'image/gif' })]);
    expect(c.error()).toContain('PNG, JPG or WebP');
    http.expectNone(() => true);
  });

  it('shows the server error if the upload link is refused', async () => {
    const { fixture, http } = await create();
    const c = fixture.componentInstance;
    c.addFiles([new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })]);
    http
      .expectOne((r) => r.url.endsWith('/upload-url'))
      .flush({ error: 'Up to 6 images per section.' }, { status: 400, statusText: 'Bad Request' });
    expect(c.error()).toBe('Up to 6 images per section.');
    expect(c.uploads().length).toBe(0);
  });
});
