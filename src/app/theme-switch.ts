import { Component, inject, input } from '@angular/core';
import { ThemePref, ThemeService } from './theme';

const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
  { value: 'system', label: 'System', icon: '' },
];

// Light / Dark / System. "compact" sits in the sidebar; "cards" on the Account page
// shows a small preview of each.
@Component({
  selector: 'app-theme-switch',
  template: `
    @if (variant() === 'compact') {
      <div
        role="radiogroup"
        aria-label="Theme"
        class="grid grid-cols-3 gap-0.5 p-0.5 rounded-xl bg-tone-0e1626 border border-tone-1c2840 text-[11px]"
      >
        @for (o of options; track o.value) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="theme.pref() === o.value"
            (click)="theme.set(o.value)"
            class="py-1 rounded-lg border transition-colors"
            [class]="
              theme.pref() === o.value
                ? 'bg-tone-121722 border-tone-1f293d text-white font-semibold shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            "
          >
            {{ o.icon }} {{ o.label }}
          </button>
        }
      </div>
    } @else {
      <div role="radiogroup" aria-label="Theme" class="grid grid-cols-3 gap-3">
        @for (o of options; track o.value) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="theme.pref() === o.value"
            (click)="theme.set(o.value)"
            class="text-left rounded-xl border-2 p-2 transition-colors"
            [class]="
              theme.pref() === o.value
                ? 'border-blue-500'
                : 'border-tone-1f293d hover:border-tone-26354f'
            "
          >
            <!-- Fixed colors on purpose: each preview always shows its own theme -->
            <span
              class="block h-14 rounded-lg overflow-hidden border"
              [style.border-color]="o.value === 'dark' ? '#1f293d' : '#e2e8f0'"
              [style.background]="
                o.value === 'system'
                  ? 'linear-gradient(90deg, #f5f7fb 50%, #0b0e14 50%)'
                  : o.value === 'dark'
                    ? '#0b0e14'
                    : '#f5f7fb'
              "
            >
              @if (o.value !== 'system') {
                <span
                  class="block h-full w-1/3 border-r"
                  [style.background]="o.value === 'dark' ? '#0b0e14' : '#ffffff'"
                  [style.border-color]="o.value === 'dark' ? '#1f293d' : '#e2e8f0'"
                ></span>
              }
            </span>
            <span class="block mt-1.5 text-xs text-slate-200">{{ o.icon }} {{ o.label }}</span>
          </button>
        }
      </div>
    }
  `,
})
export class ThemeSwitch {
  readonly theme = inject(ThemeService);
  readonly variant = input<'compact' | 'cards'>('compact');
  readonly options = OPTIONS;
}
