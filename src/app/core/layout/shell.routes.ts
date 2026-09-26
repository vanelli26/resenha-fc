import { Routes } from '@angular/router';
import { adminGeralGuard } from '../time/time.guards';
import { Shell } from './shell';

export const SHELL_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      {
        path: '',
        title: 'Meus times · ResenhaFC',
        loadComponent: () => import('../../features/inicio/inicio-page').then((m) => m.InicioPage),
      },
      {
        path: 'admin/times',
        canActivate: [adminGeralGuard],
        title: 'Times · ResenhaFC',
        loadComponent: () => import('../../features/times/times-admin-page').then((m) => m.TimesAdminPage),
      },
      {
        path: 'convite/:timeId/:codigo',
        title: 'Convite · ResenhaFC',
        loadComponent: () => import('../../features/convites/entrar-convite-page').then((m) => m.EntrarConvitePage),
      },
      {
        path: 't/:timeId',
        loadChildren: () => import('../../features/time/time.routes').then((m) => m.TIME_ROUTES),
      },
    ],
  },
];
