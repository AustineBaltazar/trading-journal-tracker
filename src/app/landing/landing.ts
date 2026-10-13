import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../brand';
import { LandingFooter, LandingHeader, ShotFrame, useShot } from './landing-parts';

const FEATURES = [
  {
    icon: '📝',
    tint: 'bg-blue-500/15',
    title: 'Log a trade in 3 steps',
    text: 'Entry, stop, target, emotions, grade, rules and screenshots. Paste a chart straight from your clipboard.',
  },
  {
    icon: '🔍',
    tint: 'bg-rose-500/15',
    title: 'See your leaks and edges',
    text: 'Patterns found for you and ranked by money, like "you lose every Range day trade".',
  },
  {
    icon: '📊',
    tint: 'bg-emerald-500/15',
    title: 'Reports on one screen',
    text: 'Win rate, expectancy in R, best days and hours, cost of mistakes, rules followed, tags compared.',
  },
  {
    icon: '📘',
    tint: 'bg-violet-500/15',
    title: 'Playbook and daily journal',
    text: 'Your rules, mistakes and review questions. A plan before the session and a review after it.',
  },
  {
    icon: '🧪',
    tint: 'bg-amber-500/15',
    title: 'Live and backtest, kept apart',
    text: 'One switch. Practice a setup without mixing it into your real stats.',
  },
  {
    icon: '⌕',
    tint: 'bg-slate-500/15',
    title: 'Search everything you wrote',
    text: 'Find every note that says "tired" and see how those trades went.',
  },
];

const FAQ = [
  {
    q: 'Is it free?',
    a: "Yes, it's free while it's in beta. You'll be told well before anything changes.",
  },
  {
    q: 'Does it connect to my broker?',
    a: 'Not yet. You log trades yourself, which takes under a minute and makes you think about each one.',
  },
  {
    q: 'Who can see my trades?',
    a: 'Only you. You can export everything or delete your account any time. See the Privacy page.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. It shows you your own numbers. What you do with them is up to you.',
  },
];

// The public homepage. Logged-in visitors skip it and land in their journal.
@Component({
  selector: 'app-landing',
  imports: [RouterLink, LandingHeader, LandingFooter, ShotFrame],
  template: `
    <div
      class="min-h-screen bg-tone-070a10 text-slate-200 bg-[radial-gradient(1100px_600px_at_80%_-10%,rgba(16,185,129,0.14),transparent_60%),radial-gradient(900px_600px_at_-10%_30%,rgba(59,130,246,0.12),transparent_60%)]"
    >
      <app-landing-header />

      <main>
        <section class="text-center px-6 pt-12 md:pt-16">
          <p class="font-mono text-xs tracking-[0.16em] uppercase text-emerald-400">
            Free trading journal for MNQ futures
          </p>
          <h1
            class="mt-4 text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.03] text-white"
          >
            Know why you <span class="text-emerald-400">win</span><br />
            and why you <span class="text-rose-400">lose</span>.
          </h1>
          <p class="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Log your trades in seconds. {{ brand.name }} turns them into plain answers: which
            setups, sessions and habits make you money, and which ones quietly cost you.
          </p>
          <div class="mt-8 flex flex-wrap gap-3 justify-center">
            <a
              routerLink="/register"
              class="px-6 py-3.5 rounded-xl font-bold text-on-solid bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400"
              >Start your journal, free →</a
            >
            <a
              routerLink="/login"
              class="px-6 py-3.5 rounded-xl font-semibold border border-tone-26354f text-slate-200 hover:border-slate-500"
              >Log in</a
            >
          </div>
          <p class="mt-3.5 text-xs text-slate-500">
            No card needed · Free during beta · Sign up with Google or email
          </p>
        </section>

        <div class="px-4 md:px-24 pt-12 md:pt-14 max-w-7xl mx-auto">
          <app-shot-frame
            [src]="shot('dashboard')"
            alt="The dashboard: total P/L, win rate, equity curve and a monthly P/L calendar"
            [lazy]="false"
          />
        </div>

        <section id="features" class="px-6 md:px-16 pt-24 pb-6 max-w-7xl mx-auto scroll-mt-6">
          <p class="font-mono text-xs tracking-[0.16em] uppercase text-blue-400 text-center">
            What you get
          </p>
          <h2
            class="mt-3 text-3xl md:text-5xl font-extrabold tracking-tight text-center text-white"
          >
            Everything a trading journal should do.<br />
            <span class="text-slate-500">Nothing it shouldn't.</span>
          </h2>
          <div class="mt-11 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            @for (f of features; track f.title) {
              <div class="rounded-2xl p-6 bg-tone-121722 border border-tone-1f293d">
                <div
                  class="w-11 h-11 rounded-xl grid place-items-center text-xl mb-3.5"
                  [class]="f.tint"
                  aria-hidden="true"
                >
                  {{ f.icon }}
                </div>
                <h3 class="text-lg font-bold text-white">{{ f.title }}</h3>
                <p class="mt-2 text-slate-400 leading-relaxed">{{ f.text }}</p>
              </div>
            }
          </div>
        </section>

        <section
          id="insights"
          class="px-6 md:px-16 py-20 grid gap-12 lg:grid-cols-[1fr_1.25fr] items-center max-w-7xl mx-auto scroll-mt-6"
        >
          <div>
            <p class="font-mono text-xs tracking-[0.16em] uppercase text-rose-400">Insights</p>
            <h2 class="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Your journal already knows what's costing you.
            </h2>
            <p class="mt-4 text-lg text-slate-400 leading-relaxed">
              Most traders write a journal and never read it back. {{ brand.name }} reads it for you
              and ranks every pattern by how much money it's worth, so you know the one thing to fix
              first.
            </p>
          </div>
          <app-shot-frame
            [src]="shot('insights')"
            alt="The Insights page: leaks and edges ranked by money, with streaks and records"
            [bar]="false"
          />
        </section>

        <section id="faq" class="px-6 md:px-16 pb-20 scroll-mt-6">
          <h2 class="text-3xl font-extrabold text-center text-white">Questions</h2>
          <dl class="max-w-3xl mx-auto mt-8">
            @for (item of faq; track item.q) {
              <div class="py-4 border-t border-tone-1f293d">
                <dt class="font-bold text-white">{{ item.q }}</dt>
                <dd class="mt-1 text-slate-400">{{ item.a }}</dd>
              </div>
            }
          </dl>
        </section>

        <section
          class="mx-4 md:mx-16 mb-14 rounded-3xl px-6 py-14 text-center border border-emerald-400/25 bg-[linear-gradient(120deg,rgba(37,99,235,0.22),rgba(16,185,129,0.18))]"
        >
          <h2 class="text-3xl md:text-4xl font-extrabold text-white">Start your journal today.</h2>
          <p class="mt-3 text-lg text-slate-300">
            Free during beta. Sign up with Google in seconds.
          </p>
          <a
            routerLink="/register"
            class="inline-block mt-7 px-7 py-3.5 rounded-xl font-bold text-on-solid bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400"
            >Start free →</a
          >
        </section>
      </main>

      <app-landing-footer />
    </div>
  `,
})
export class Landing {
  readonly brand = BRAND;
  readonly features = FEATURES;
  readonly faq = FAQ;
  readonly shot = useShot();
}
