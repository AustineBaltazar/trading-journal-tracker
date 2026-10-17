import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MODE_SWITCH, TradeMode, TradeModeService } from '../trade-mode';
import { AuthService } from '../auth/auth';
import { FeedbackButton } from '../feedback/feedback';
import { AdminService } from '../admin/admin';
import { ThemeSwitch } from '../theme-switch';
import { BRAND } from '../brand';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FeedbackButton, ThemeSwitch],
  selector: 'app-layout',
  styleUrl: './layout.css',
  templateUrl: './layout.html',
})
export class Layout {
  private router = inject(Router);
  private auth = inject(AuthService);
  private admin = inject(AdminService);
  readonly tradeMode = inject(TradeModeService);
  readonly modeSwitch = MODE_SWITCH;
  readonly modes: { key: TradeMode; label: string; on: string }[] = [
    { key: 'live', label: 'Live', on: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
    { key: 'eval', label: 'Eval', on: 'bg-amber-500/15 text-amber-300 border-amber-500/45' },
    {
      key: 'backtest',
      label: 'Backtest',
      on: 'bg-violet-500/15 text-violet-300 border-violet-500/45',
    },
  ];
  readonly brand = BRAND;

  // Phones: the "More" sheet and what's in it
  readonly moreOpen = signal(false);
  readonly moreLinks = [
    { path: '/reports', label: 'Reports', icon: '📊', badge: '' },
    { path: '/insights', label: 'Insights', icon: '💡', badge: 'NEW' },
    { path: '/playbook', label: 'Playbook', icon: '📘', badge: '' },
    { path: '/account', label: 'Account & security', icon: '👤', badge: '' },
  ];
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  // Phones hide the tabs while a trade is being filled in: the form has its own buttons
  readonly onTradeForm = computed(() => this.url().startsWith('/trades/new'));
  // "More" lights up while on one of its pages
  readonly onMorePage = computed(() =>
    ['/reports', '/insights', '/playbook', '/account', '/admin'].some((p) =>
      this.url().startsWith(p),
    ),
  );

  userName = computed(() => this.auth.user()?.name || 'Account');
  isDemo = computed(() => !!this.auth.user()?.demo);
  isAdmin = computed(() => !!this.auth.user()?.admin);
  newFeedback = this.admin.newCount;

  constructor() {
    if (this.isAdmin()) this.admin.refreshNewCount();
  }

  logout() {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }

  // From the demo banner: leave the demo, then sign up
  signUpInstead() {
    this.auth.logout().subscribe(() => this.router.navigate(['/register']));
  }
}
