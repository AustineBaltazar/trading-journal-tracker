import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Layout } from './layout';

describe('Layout', () => {
  let component: Layout;
  let fixture: ComponentFixture<Layout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Layout],
      providers: [provideRouter([{ path: '**', children: [] }])],
    }).compileComponents();

    fixture = TestBed.createComponent(Layout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('phones get bottom tabs, and More opens a sheet with the other pages', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const tabs = el.querySelector('nav[aria-label="Main"]')!;
    expect([...tabs.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/dashboard',
      '/trades',
      '/trades/new',
      '/journal',
    ]);
    expect(el.querySelector('[aria-label="More"]')).toBeNull();

    (tabs.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    const sheet = el.querySelector('[aria-label="More"]')!;
    const links = [...sheet.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/reports', '/insights', '/playbook', '/account']);
    expect(sheet.textContent).toContain('Log out');

    (sheet.querySelector('a') as HTMLAnchorElement).click();
    await fixture.whenStable();
    expect(el.querySelector('[aria-label="More"]')).toBeNull();
  });
});
