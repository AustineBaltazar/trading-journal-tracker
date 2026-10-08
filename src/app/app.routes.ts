import { Routes } from '@angular/router';
import { Login } from './login/login';
import { TradesList } from './trades-list/trades-list';
import { NewTrade } from './new-trade/new-trade';
import { TradeDetails } from './trade-details/trade-details';
import { Dashboard } from './dashboard/dashboard';
import { Layout } from './layout/layout';
import { authGuard } from './auth-guard';
import { Playbook } from './playbook/playbook';
import { Register } from './register/register';
export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'trades', component: TradesList },
      { path: 'trades/new', component: NewTrade },
      { path: 'trades/:id', component: TradeDetails },
      {
        path: 'journal',
        loadComponent: () => import('./journal/journal').then((m) => m.Journal),
      },
      { path: 'playbook', component: Playbook },
    ],
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
