import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TradeModeService } from '../trade-mode';
import { AuthService } from '../auth/auth';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-layout',
  styleUrl: './layout.css',
  templateUrl: './layout.html',
})
export class Layout {
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly tradeMode = inject(TradeModeService);

  userName = computed(() => this.auth.user()?.name || 'Account');

  logout() {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
