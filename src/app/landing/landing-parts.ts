import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../brand';
import { ThemeService } from '../theme';

// A screenshot of the app that matches the visitor's light/dark theme
export function useShot() {
  const theme = inject(ThemeService);
  return (name: 'dashboard' | 'insights' | 'reports') => `landing/${name}-${theme.theme()}.png`;
}

// Logo + name, shared by the public pages
@Component({
  selector: 'app-brand-mark',
  template: `
    <span class="flex items-center gap-2.5">
      <span
        class="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 p-[1.5px] flex items-center justify-center shadow-lg shadow-blue-500/20"
      >
        <span class="h-full w-full bg-tone-0b0e14 rounded-[10px] flex items-center justify-center">
          <svg
            class="w-5 h-5 text-emerald-400"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </span>
      </span>
      <span class="font-extrabold tracking-tight text-white text-lg">{{ brand.first }}</span>
      <span class="text-sm text-slate-500 font-mono">/</span>
      <span class="text-sm font-semibold text-slate-300 tracking-wider">{{ brand.second }}</span>
      <span
        class="ml-1 text-[9.5px] font-bold tracking-wider px-1.5 py-px rounded-full border border-amber-400/45 text-amber-300 bg-amber-400/10"
        >BETA</span
      >
    </span>
  `,
})
export class BrandMark {
  readonly brand = BRAND;
}

@Component({
  selector: 'app-landing-header',
  imports: [RouterLink, BrandMark],
  template: `
    <header class="flex items-center justify-between gap-4 px-6 md:px-16 py-5">
      <a routerLink="/" [attr.aria-label]="brand.name + ' home'"><app-brand-mark /></a>
      @if (links()) {
        <nav class="hidden md:flex gap-8 text-sm text-slate-400" aria-label="Sections">
          <a href="#features" class="hover:text-white">Features</a>
          <a href="#insights" class="hover:text-white">Insights</a>
          <a href="#faq" class="hover:text-white">FAQ</a>
        </nav>
      }
      <div class="flex items-center gap-3 text-sm">
        <a routerLink="/login" class="text-slate-300 hover:text-white whitespace-nowrap">Log in</a>
        @if (links()) {
          <a
            routerLink="/register"
            class="px-3 sm:px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-on-solid bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400"
            >Start free</a
          >
        }
      </div>
    </header>
  `,
})
export class LandingHeader {
  readonly brand = BRAND;
  // The ad page keeps the header to just "Log in"
  readonly links = input(true);
}

@Component({
  selector: 'app-landing-footer',
  imports: [RouterLink],
  template: `
    <footer
      class="flex flex-col sm:flex-row gap-2 justify-between px-6 md:px-16 py-7 text-xs text-slate-500"
    >
      <span>© {{ year }} {{ brand.name }} · Not financial advice</span>
      <span>
        <a routerLink="/privacy" class="hover:text-slate-300">Privacy</a> ·
        <a routerLink="/terms" class="hover:text-slate-300">Terms</a>
      </span>
    </footer>
  `,
})
export class LandingFooter {
  readonly brand = BRAND;
  readonly year = new Date().getFullYear();
}

// The app screenshot in a browser-style frame
@Component({
  selector: 'app-shot-frame',
  template: `
    <div
      class="rounded-2xl overflow-hidden border border-tone-1f293d bg-tone-0b0e14 shadow-2xl shadow-black/40"
    >
      @if (bar()) {
        <div class="h-7 flex items-center gap-1.5 px-3 bg-tone-121722" aria-hidden="true">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
        </div>
      }
      <img
        [src]="src()"
        [alt]="alt()"
        width="1440"
        height="900"
        [attr.loading]="lazy() ? 'lazy' : null"
        class="block w-full h-auto"
      />
    </div>
  `,
})
export class ShotFrame {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  readonly bar = input(true);
  readonly lazy = input(true);
}
