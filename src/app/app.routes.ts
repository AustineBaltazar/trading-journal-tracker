import { Routes } from '@angular/router';
import { Login } from './login/login';
import { TradesList } from './trades-list/trades-list';
import { NewTrade } from './new-trade/new-trade';
import { authGuard } from './auth-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'trades', component: TradesList, canActivate: [authGuard] },
  { path: 'trades/new', component: NewTrade, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
