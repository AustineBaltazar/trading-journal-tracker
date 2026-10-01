import { Routes } from '@angular/router';
import { Login } from './login/login';
import { TradesList } from './trades-list/trades-list';
import { NewTrade } from './new-trade/new-trade';
import { EditTrade } from './edit-trade/edit-trade';
import { TradeDetails } from './trade-details/trade-details';
import { Dashboard } from './dashboard/dashboard';
import { Rules } from './rules/rules';
import { Questions } from './questions/questions';
import { Layout } from './layout/layout';
import { authGuard } from './auth-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'trades', component: TradesList },
      { path: 'trades/new', component: NewTrade },
      { path: 'trades/edit/:id', component: EditTrade },
      { path: 'trades/:id', component: TradeDetails },
      { path: 'rules', component: Rules },
      { path: 'questions', component: Questions },
    ],
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
