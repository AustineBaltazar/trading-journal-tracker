import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { FeedbackInbox, filterParams } from './feedback-inbox';
import { FeedbackItem, FeedbackPage, replyLink, sentAgo } from './admin';

const item = (id: number, extra: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id,
  kind: 'bug',
  message: `Message ${id}`,
  page: '/trades/5',
  device: 'Safari on iPhone',
  status: 'new',
  note: null,
  createdAt: '2026-10-11T10:00:00Z',
  user: {
    id: 3,
    name: 'Andrei',
    email: 'andrei@gmail.com',
    demo: false,
    joinedAt: '2026-10-10T00:00:00Z',
    trades: 50,
  },
  ...extra,
});

const pageOf = (items: FeedbackItem[], extra: Partial<FeedbackPage> = {}): FeedbackPage => ({
  items,
  total: 23,
  page: 1,
  pageSize: 8,
  pages: 3,
  counts: { all: 23, new: 3, working: 2, done: 18, bug: 5, idea: 8, other: 10, thisWeek: 6 },
  users: { total: 17, newThisWeek: 4 },
  ...extra,
});

describe('admin helpers', () => {
  it('turns a filter into status or kind', () => {
    expect(filterParams('all')).toEqual({});
    expect(filterParams('working')).toEqual({ status: 'working' });
    expect(filterParams('idea')).toEqual({ kind: 'idea' });
  });

  it('says when it was sent', () => {
    const now = new Date('2026-10-11T12:00:00Z').getTime();
    expect(sentAgo('2026-10-11T11:48:00Z', now)).toBe('12 min ago');
    expect(sentAgo('2026-10-11T10:00:00Z', now)).toBe('2 hours ago');
    expect(sentAgo('2026-10-10T08:00:00Z', now)).toBe('Yesterday');
    expect(sentAgo('2026-10-08T08:00:00Z', now)).toBe('Oct 8');
  });

  it('replies by email with their message quoted', () => {
    const link = replyLink(item(1, { message: 'line one\nline two' }))!;
    expect(link.startsWith('mailto:andrei@gmail.com?subject=')).toBe(true);
    expect(decodeURIComponent(link)).toContain('> line one\n> line two');
    expect(replyLink(item(2, { user: null }))).toBeNull();
  });
});

describe('FeedbackInbox', () => {
  let http: HttpTestingController;

  async function open(url = '/admin/feedback') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/feedback', component: FeedbackInbox }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(FeedbackInbox);
    return fixture;
  }

  it('asks for the page and filter in the address bar', async () => {
    const fixture = await open('/admin/feedback?filter=bug&page=2&q=upload');
    const req = http.expectOne((r) => r.url.endsWith('/admin/feedback'));
    expect(req.request.params.get('kind')).toBe('bug');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('q')).toBe('upload');
    req.flush(pageOf([item(9), item(10)], { page: 2 }));
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Showing 9–10 of 23');
    expect(fixture.componentInstance.selected()?.id).toBe(9);
  });

  it('changing the status updates the row and the counts', async () => {
    const fixture = await open();
    http.expectOne((r) => r.url.endsWith('/admin/feedback')).flush(pageOf([item(1), item(2)]));
    await fixture.whenStable();
    const inbox = fixture.componentInstance;
    inbox.setStatus(inbox.selected()!, 'done');
    const patch = http.expectOne((r) => r.method === 'PATCH');
    expect(patch.request.body).toEqual({ status: 'done' });
    patch.flush({ id: 1, status: 'done', note: null });
    http.match((r) => r.url.endsWith('/new-count')).forEach((r) => r.flush({ new: 2 }));
    expect(inbox.data()!.items[0].status).toBe('done');
    expect(inbox.data()!.counts).toMatchObject({ new: 2, done: 19 });
  });
});
