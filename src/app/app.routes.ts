import { Routes } from '@angular/router';
import { authGuard, visitanteGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [visitanteGuard],
    title: 'Entrar · ResenhaFC',
    loadComponent: () => import('./features/auth/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    // Rotas autenticadas em arquivo lazy: mantém Firestore e guards de sessão fora do bundle inicial.
    loadChildren: () => import('./core/layout/shell.routes').then((m) => m.SHELL_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
