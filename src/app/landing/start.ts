import { Component } from '@angular/core';
import { Register } from '../register/register';
import { LandingFooter, LandingHeader, ShotFrame, useShot } from './landing-parts';

const POINTS = [
  'Log a trade in under a minute, screenshots included',
  'See which setups and habits make or lose you money',
  'Reports, Insights, Playbook and a daily journal',
];

const BADGES = [
  { title: 'Free', text: 'during the whole beta' },
  { title: 'Private', text: 'only you see your trades' },
  { title: 'Yours', text: 'export or delete any time' },
  { title: 'Insights', text: 'leaks and edges found for you' },
];

// Short sign-up page for people arriving from an ad: what it is, and the form right there
@Component({
  selector: 'app-start',
  imports: [Register, LandingHeader, LandingFooter, ShotFrame],
  template: `
    <div
      class="min-h-screen bg-tone-0b0e14 text-slate-200 bg-[radial-gradient(900px_500px_at_70%_0%,rgba(16,185,129,0.12),transparent_60%)]"
    >
      <app-landing-header [links]="false" />
      <main>
        <section
          class="px-6 md:px-16 pt-8 md:pt-12 pb-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center max-w-7xl mx-auto"
        >
          <div>
            <h1
              class="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.08] text-white"
            >
              The free trading journal<br />for <span class="text-emerald-400">MNQ</span> traders.
            </h1>
            <ul class="mt-8 space-y-3.5 text-lg">
              @for (p of points; track p) {
                <li class="flex gap-3"><span aria-hidden="true">✅</span>{{ p }}</li>
              }
            </ul>
            <div class="mt-10 max-w-2xl hidden md:block">
              <app-shot-frame
                [src]="shot('reports')"
                alt="The Reports overview: what's working, what's hurting, and a card per report"
                [bar]="false"
                [lazy]="false"
              />
            </div>
          </div>
          <div
            class="bg-tone-121722 border border-tone-1f293d rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/40"
          >
            <app-register [embedded]="true" />
          </div>
        </section>
        <section
          class="px-6 md:px-16 pb-12 grid gap-4 grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
        >
          @for (b of badges; track b.title) {
            <div class="rounded-2xl p-4 border border-tone-1f293d bg-tone-0e131c">
              <p class="font-bold text-white">{{ b.title }}</p>
              <p class="mt-1 text-sm text-slate-400">{{ b.text }}</p>
            </div>
          }
        </section>
      </main>
      <app-landing-footer />
    </div>
  `,
})
export class Start {
  readonly points = POINTS;
  readonly badges = BADGES;
  readonly shot = useShot();
}
