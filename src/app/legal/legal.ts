import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { BRAND } from '../brand';

const UPDATED = 'October 11, 2026';
const CONTACT = 'brotradingjournal@gmail.com';

// The Privacy policy and Terms of use. Both describe how the app really works today;
// update them whenever that changes.
@Component({
  selector: 'app-legal',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-tone-0b0e14 text-slate-300">
      <div class="max-w-2xl mx-auto px-5 py-10">
        <button
          type="button"
          (click)="back()"
          class="text-xs text-blue-400 hover:text-blue-300 mb-6"
        >
          ‹ Back
        </button>
        <p class="text-xs text-slate-500 mb-1">
          MNQ JOURNAL <span class="text-amber-300">BETA</span> · Last updated {{ updated }}
        </p>

        @if (page === 'privacy') {
          <h1 class="text-2xl font-semibold text-white mb-6">Privacy policy</h1>
          <div class="legal space-y-4 text-sm leading-relaxed">
            <p>
              {{ brand.name }} is a trading journal run by an independent developer. This page
              explains what it stores about you, why, and what you can do about it.
            </p>
            <h2>What we store</h2>
            <ul>
              <li>
                <b>Your account:</b> name, email address, and your password in scrambled form
                (Argon2). We can't see your password.
              </li>
              <li>
                <b>Your journal:</b> the trades, notes, rules, review answers, tags, journal entries
                and screenshots you add.
              </li>
              <li>
                <b>Login records:</b> when you log in or a wrong password is tried, with the browser
                and IP address. These protect your account and appear on your Account &amp; security
                page.
              </li>
              <li>
                <b>Feedback</b> you send with the Feedback button, with the page you were on if you
                choose.
              </li>
            </ul>
            <h2>Why</h2>
            <p>
              Only to run your journal, keep your account secure, send you account emails
              (confirming your address, password resets and security alerts), and improve the app
              from your feedback. We don't sell your data, show ads, or use tracking or analytics
              cookies.
            </p>
            <h2>Where it's kept and who helps run the app</h2>
            <ul>
              <li>
                <b>Amazon Web Services</b> (Singapore region) hosts the app, the database, your
                screenshots and nightly backups.
              </li>
              <li><b>Google (Gmail)</b> delivers our emails.</li>
              <li>
                <b>Cloudflare Turnstile</b> checks that sign-ups and some logins come from a person,
                not a bot.
              </li>
              <li>
                <b>Have I Been Pwned</b> checks new passwords against known data leaks. Only the
                first 5 characters of a scrambled form of the password are sent, never the password
                itself.
              </li>
            </ul>
            <h2>Cookies</h2>
            <p>
              One cookie keeps you logged in. It can't be read by the page's scripts and is needed
              for the app to work. Your browser also remembers a few display choices (like light or
              dark theme) on your device only.
            </p>
            <h2>Your choices</h2>
            <ul>
              <li><b>Download</b> all your data any time from Account &amp; security.</li>
              <li>
                <b>Delete</b> your account there too. It removes your account, journal and
                screenshots straight away. Backups may hold a copy for a short time until they're
                replaced. Feedback you sent is kept without your name.
              </li>
              <li>
                <b>Ask</b> anything about your data at
                <a [href]="'mailto:' + contact">{{ contact }}</a
                >.
              </li>
            </ul>
            <h2>Children</h2>
            <p>{{ brand.name }} isn't meant for anyone under 16.</p>
            <h2>Changes</h2>
            <p>
              If this policy changes in a way that matters, we'll say so in the app or by email
              before it takes effect.
            </p>
          </div>
        } @else {
          <h1 class="text-2xl font-semibold text-white mb-6">Terms of use</h1>
          <div class="legal space-y-4 text-sm leading-relaxed">
            <p>By creating an account you agree to these terms.</p>
            <h2>A free beta</h2>
            <p>
              {{ brand.name }} is free while it's in beta. It's provided as is: features may change,
              and the app may be unavailable or stop altogether. Keep your own copy of anything
              important using the export on your Account &amp; security page.
            </p>
            <h2>Not financial advice</h2>
            <p>
              {{ brand.name }} is a journal. Nothing in it, including its statistics, reports and
              suggestions, is financial, investment or trading advice. Trading futures is risky and
              your trading decisions are yours alone.
            </p>
            <h2>Your account</h2>
            <ul>
              <li>Use a real email address you control, and keep your password to yourself.</li>
              <li>
                You're responsible for what happens under your account. Tell us at
                <a [href]="'mailto:' + contact">{{ contact }}</a> if you think someone else got in.
              </li>
              <li>One person per account. You must be at least 16.</li>
            </ul>
            <h2>Your content</h2>
            <p>
              What you put in your journal stays yours. You give us permission to store and show it
              to you only so the app can work. Don't upload anything you don't have the right to, or
              anything illegal.
            </p>
            <h2>Fair use</h2>
            <ul>
              <li>
                Don't try to break, overload or get around the app's security, or access other
                people's accounts.
              </li>
              <li>Don't use bots or scripts to create accounts or send requests.</li>
            </ul>
            <p>We may suspend or delete accounts that break these rules.</p>
            <h2>Limits</h2>
            <p>
              As far as the law allows, we aren't liable for trading losses, lost data, or any
              indirect damage from using or not being able to use the app.
            </p>
            <h2>Changes and contact</h2>
            <p>
              We may update these terms; we'll say so in the app or by email before changes that
              matter take effect. Questions: <a [href]="'mailto:' + contact">{{ contact }}</a
              >.
            </p>
          </div>
        }

        <p class="text-xs text-slate-500 mt-10">
          <a routerLink="/privacy" class="text-blue-400 hover:text-blue-300">Privacy policy</a> ·
          <a routerLink="/terms" class="text-blue-400 hover:text-blue-300">Terms of use</a>
        </p>
      </div>
    </div>
  `,
  styles: `
    .legal h2 {
      color: var(--color-white);
      font-size: 1rem;
      font-weight: 600;
      margin-top: 1.5rem;
    }
    .legal ul {
      list-style: disc;
      padding-left: 1.25rem;
    }
    .legal li + li {
      margin-top: 0.4rem;
    }
    .legal a {
      color: var(--color-blue-400);
    }
    .legal b {
      color: var(--color-slate-200);
      font-weight: 600;
    }
  `,
})
export class Legal {
  readonly brand = BRAND;
  private location = inject(Location);
  readonly page = inject(ActivatedRoute).snapshot.data['page'] as 'privacy' | 'terms';
  readonly updated = UPDATED;
  readonly contact = CONTACT;

  back() {
    this.location.back();
  }
}
