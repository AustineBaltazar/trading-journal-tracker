import { Injectable, signal } from '@angular/core';

export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

const KEY = 'theme';

export function storedPref(): ThemePref {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function resolveTheme(pref: ThemePref): Theme {
  return pref === 'system' ? systemTheme() : pref;
}

// The colors in styles.css switch on <html data-theme="light|dark">
export function applyTheme(theme: Theme) {
  document.documentElement.dataset['theme'] = theme;
}

// Light, Dark, or follow the computer ("System", the default). Remembered per device.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly pref = signal<ThemePref>(storedPref());
  readonly theme = signal<Theme>(resolveTheme(this.pref()));

  constructor() {
    applyTheme(this.theme());
    // While on "System", follow the computer when it switches (e.g. at sunset)
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
        if (this.pref() === 'system') this.update();
      });
    }
  }

  set(pref: ThemePref) {
    this.pref.set(pref);
    try {
      if (pref === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      // still applies for this visit
    }
    this.update();
  }

  private update() {
    this.theme.set(resolveTheme(this.pref()));
    applyTheme(this.theme());
  }
}
