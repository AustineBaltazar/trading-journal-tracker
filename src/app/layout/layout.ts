import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TradeModeService } from '../trade-mode';
import { AuthService } from '../auth/auth';
import { FeedbackButton } from '../feedback/feedback';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FeedbackButton],
  selector: 'app-layout',
  styleUrl: './layout.css',
  templateUrl: './layout.html',
})
export class Layout {
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly tradeMode = inject(TradeModeService);

  userName = computed(() => this.auth.user()?.name || 'Account');
  isDemo = computed(() => !!this.auth.user()?.demo);

  logout() {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }

  // From the demo banner: leave the demo, then sign up
  signUpInstead() {
    this.auth.logout().subscribe(() => this.router.navigate(['/register']));
  }
}
