import { Routes } from '@angular/router';
import { Login } from './login/login';
import { TradesList } from './trades-list/trades-list';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'trades', component: TradesList },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
