import { Routes } from '@angular/router';
import { Login } from './login/login';
import { TradesList } from './trades-list/trades-list';
import { NewTrade } from './new-trade/new-trade';
import { authGuard } from './auth-guard';
import { Dashboard } from './dashboard/dashboard';
import { EditTrade } from './edit-trade/edit-trade';

export const routes: Routes = [
  { path: 'login', component: Login },

  { path: 'trades', component: TradesList, canActivate: [authGuard] },
  { path: 'trades/new', component: NewTrade, canActivate: [authGuard] },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'trades/edit/:id', component: EditTrade, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
