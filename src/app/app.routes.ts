import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { authGuard, guestGuard } from './auth/auth';
import { adminGuard } from './admin/admin';
// Every page loads on demand; only the app shell (Layout) is in the first download
export const routes: Routes = [
  // Public homepage and the ad sign-up page; logged-in visitors go to their journal
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () => import('./landing/landing').then((m) => m.Landing),
  },
  {
    path: 'start',
    canActivate: [guestGuard],
    loadComponent: () => import('./landing/start').then((m) => m.Start),
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register').then((m) => m.Register),
    canActivate: [guestGuard],
  },
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
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'trades',
        loadComponent: () => import('./trades-list/trades-list').then((m) => m.TradesList),
      },
      {
        path: 'trades/new',
        loadComponent: () => import('./new-trade/new-trade').then((m) => m.NewTrade),
      },
      {
        path: 'trades/:id',
        loadComponent: () => import('./trade-details/trade-details').then((m) => m.TradeDetails),
      },
      {
        path: 'journal',
        loadComponent: () => import('./journal/journal').then((m) => m.Journal),
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports').then((m) => m.Reports),
      },
      {
        path: 'insights',
        loadComponent: () => import('./insights/insights').then((m) => m.Insights),
      },
      {
        path: 'playbook',
        loadComponent: () => import('./playbook/playbook').then((m) => m.Playbook),
      },
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
];
