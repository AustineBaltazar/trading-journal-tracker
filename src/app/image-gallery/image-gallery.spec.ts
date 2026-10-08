import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImageGallery, ImageTarget, imageFileError } from './image-gallery';

const journalTarget: ImageTarget = {
  base: 'https://api.test/journal/2026-09-23/images',
  item: 'https://api.test/journal/images',
  body: { section: 'pre' },
  params: { mode: 'backtest' },
};

describe('imageFileError', () => {
  it('allows PNG, JPG and WebP up to 5 MB', () => {
    expect(imageFileError({ type: 'image/png', size: 1000 })).toBeNull();
    expect(imageFileError({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBeNull();
    expect(imageFileError({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPG or WebP/);
    expect(imageFileError({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});

describe('ImageGallery', () => {
  async function create(target: ImageTarget | null = journalTarget) {
    await TestBed.configureTestingModule({
      imports: [ImageGallery],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ImageGallery);
    fixture.componentRef.setInput('target', target);
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
    await fixture.whenStable();

    expect(added.map((a) => a.id)).toEqual([9]);
    expect(c.uploads().length).toBe(0);
  });

  it('without a target, queues files and uploads them later with their captions', async () => {
    const { fixture, http } = await create(null);
    const c = fixture.componentInstance;
    const added: any[] = [];
    c.added.subscribe((img) => added.push(img));
    c.addFiles([
      new File([new Uint8Array(10)], 'entry.png', { type: 'image/png' }),
      new File([new Uint8Array(20)], 'exit.webp', { type: 'image/webp' }),
    ]);
    http.expectNone(() => true);
    expect(c.shown().length).toBe(2);
    c.saveCaption(c.shown()[0], 'Entry 1m');
    c.remove(c.shown()[1]);
    expect(c.queued().map((q) => q.caption)).toEqual(['Entry 1m']);

    const done = c.uploadQueued({
      base: 'https://api.test/trades/42/images',
      item: 'https://api.test/trade-images',
    });
    const link = http.expectOne('https://api.test/trades/42/images/upload-url');
    expect(link.request.body).toEqual({ content_type: 'image/png', size_bytes: 10 });
    link.flush({ key: 'users/1/trades/42/a.png', uploadUrl: 'https://s3.example.test/a' });
    http.expectOne('https://s3.example.test/a').flush(null);
    const confirm = http.expectOne(
      (r) => r.url === 'https://api.test/trades/42/images' && r.method === 'POST',
    );
    expect(confirm.request.body).toEqual({ key: 'users/1/trades/42/a.png', caption: 'Entry 1m' });
    confirm.flush({ id: 3, caption: 'Entry 1m', url: 'https://view' });

    expect(await done).toBe(0);
    expect(added.map((a) => a.id)).toEqual([3]);
    expect(c.queued().length).toBe(0);
  });

  it('counts queued files toward the limit of 6', async () => {
    const { fixture } = await create(null);
    const c = fixture.componentInstance;
    const files = Array.from(
      { length: 7 },
      (_, i) => new File(['x'], `${i}.png`, { type: 'image/png' }),
    );
    c.addFiles(files);
    expect(c.queued().length).toBe(6);
    expect(c.error()).toContain('Up to 6');
    expect(c.canAdd()).toBe(false);
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
