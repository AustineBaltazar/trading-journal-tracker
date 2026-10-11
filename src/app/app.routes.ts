import { Routes } from '@angular/router';
import { Login } from './login/login';
import { TradesList } from './trades-list/trades-list';
import { NewTrade } from './new-trade/new-trade';
import { TradeDetails } from './trade-details/trade-details';
import { Dashboard } from './dashboard/dashboard';
import { Layout } from './layout/layout';
import { authGuard, guestGuard } from './auth/auth';
import { Playbook } from './playbook/playbook';
import { Register } from './register/register';
import { adminGuard } from './admin/admin';
export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
  {
    path: 'check-email',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/check-email').then((m) => m.CheckEmail),
  },
  {
    path: 'welcome',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/welcome').then((m) => m.Welcome),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPassword),
  },
  // Public pages, and email links, open whether or not someone is logged in
  {
    path: 'privacy',
    data: { page: 'privacy' },
    loadComponent: () => import('./legal/legal').then((m) => m.Legal),
  },
  {
    path: 'terms',
    data: { page: 'terms' },
    loadComponent: () => import('./legal/legal').then((m) => m.Legal),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./auth/verify-email').then((m) => m.VerifyEmail),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./auth/reset-password').then((m) => m.ResetPassword),
  },
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
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports').then((m) => m.Reports),
      },
      { path: 'playbook', component: Playbook },
      {
        path: 'account',
        loadComponent: () => import('./account/account').then((m) => m.Account),
      },
      {
        path: 'admin/feedback',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/feedback-inbox').then((m) => m.FeedbackInbox),
      },
    ],
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
