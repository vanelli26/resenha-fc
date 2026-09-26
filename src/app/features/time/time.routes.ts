import { Routes } from '@angular/router';
import { diretoriaGuard, timeGuard } from '../../core/time/time.guards';
import { TimeLayout } from './time-layout';

export const TIME_ROUTES: Routes = [
  {
    path: '',
    component: TimeLayout,
    canActivate: [timeGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'elenco' },
      {
        path: 'elenco',
        title: 'Elenco · ResenhaFC',
        loadComponent: () => import('../elenco/elenco-page').then((m) => m.ElencoPage),
      },
      {
        path: 'membros',
        canActivate: [diretoriaGuard],
        title: 'Membros · ResenhaFC',
        loadComponent: () => import('../membros/membros-page').then((m) => m.MembrosPage),
      },
      {
        path: 'convites',
        canActivate: [diretoriaGuard],
        title: 'Convites · ResenhaFC',
        loadComponent: () => import('../convites/convites-page').then((m) => m.ConvitesPage),
      },
      {
        path: 'solicitacoes',
        canActivate: [diretoriaGuard],
        title: 'Solicitações · ResenhaFC',
        loadComponent: () => import('../solicitacoes/solicitacoes-page').then((m) => m.SolicitacoesPage),
      },
    ],
  },
];
