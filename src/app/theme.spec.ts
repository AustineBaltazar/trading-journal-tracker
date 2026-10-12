import { TestBed } from '@angular/core/testing';
import { resolveTheme, storedPref, ThemeService } from './theme';
import { ThemeSwitch } from './theme-switch';

describe('theme', () => {
  const html = document.documentElement;
  let systemLight = false;
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.removeItem('theme');
    systemLight = false;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('light') ? systemLight : false,
      addEventListener: () => {},
    })) as any;
  });
  afterEach(() => {
    localStorage.removeItem('theme');
    window.matchMedia = realMatchMedia;
    delete html.dataset['theme'];
  });

  it('defaults to System, which follows the computer', () => {
    expect(storedPref()).toBe('system');
    expect(resolveTheme('system')).toBe('dark');
    systemLight = true;
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('applies and remembers a choice; System forgets it', () => {
    const theme = TestBed.inject(ThemeService);
    expect(html.dataset['theme']).toBe('dark');
    theme.set('light');
    expect(html.dataset['theme']).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    theme.set('system');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(html.dataset['theme']).toBe('dark');
  });

  it('the sidebar switch changes the theme', async () => {
    const fixture = TestBed.createComponent(ThemeSwitch);
    await fixture.whenStable();
    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['☀ Light', '☾ Dark', 'System']);
    buttons[0].click();
    await fixture.whenStable();
    expect(html.dataset['theme']).toBe('light');
    expect(buttons[0].getAttribute('aria-checked')).toBe('true');
  });
});
