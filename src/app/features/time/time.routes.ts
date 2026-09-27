import { Routes } from '@angular/router';
import { diretoriaGuard, gestaoGuard, tesourariaGuard, timeGuard } from '../../core/time/time.guards';
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

      // Financeiro: diretoria consulta, tesouraria opera (DIRETRIZES 2.3).
      { path: 'financeiro', pathMatch: 'full', redirectTo: 'financeiro/cobrancas' },
      {
        path: 'financeiro/cobrancas',
        canActivate: [gestaoGuard],
        title: 'Cobranças · ResenhaFC',
        loadComponent: () => import('../financeiro/cobrancas-page').then((m) => m.CobrancasPage),
      },
      {
        path: 'financeiro/caixa',
        canActivate: [gestaoGuard],
        title: 'Caixa · ResenhaFC',
        loadComponent: () => import('../financeiro/caixa-page').then((m) => m.CaixaPage),
      },
      {
        path: 'financeiro/gerar',
        canActivate: [tesourariaGuard],
        title: 'Gerar cobranças · ResenhaFC',
        loadComponent: () => import('../financeiro/gerar-cobrancas-page').then((m) => m.GerarCobrancasPage),
      },

      // Gestão: hub + telas de administração do time.
      {
        path: 'gestao',
        canActivate: [gestaoGuard],
        title: 'Gestão · ResenhaFC',
        loadComponent: () => import('../gestao/gestao-page').then((m) => m.GestaoPage),
      },
      {
        path: 'gestao/membros',
        canActivate: [diretoriaGuard],
        title: 'Membros · ResenhaFC',
        loadComponent: () => import('../membros/membros-page').then((m) => m.MembrosPage),
      },
      {
        path: 'gestao/convites',
        canActivate: [diretoriaGuard],
        title: 'Convites · ResenhaFC',
        loadComponent: () => import('../convites/convites-page').then((m) => m.ConvitesPage),
      },
      {
        path: 'gestao/solicitacoes',
        canActivate: [diretoriaGuard],
        title: 'Solicitações · ResenhaFC',
        loadComponent: () => import('../solicitacoes/solicitacoes-page').then((m) => m.SolicitacoesPage),
      },
      {
        path: 'gestao/financeiro',
        canActivate: [tesourariaGuard],
        title: 'Configuração financeira · ResenhaFC',
        loadComponent: () => import('../financeiro/config-financeira-page').then((m) => m.ConfigFinanceiraPage),
      },

      // Endereços da Fase 1 (links já compartilhados/favoritos).
      { path: 'membros', redirectTo: 'gestao/membros' },
      { path: 'convites', redirectTo: 'gestao/convites' },
      { path: 'solicitacoes', redirectTo: 'gestao/solicitacoes' },
    ],
  },
];
