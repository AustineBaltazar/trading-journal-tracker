import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TradeMode, TradeModeService } from '../trade-mode';
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
