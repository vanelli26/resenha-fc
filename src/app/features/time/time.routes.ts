import { Routes } from '@angular/router';
import { diretoriaGuard, gestaoGuard, tesourariaGuard, timeGuard } from '../../core/time/time.guards';
import { TimeLayout } from './time-layout';

export const TIME_ROUTES: Routes = [
  {
    path: '',
    component: TimeLayout,
    canActivate: [timeGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mural' },
      {
        path: 'agenda',
        title: 'Agenda · ResenhaFC',
        loadComponent: () => import('../agenda/agenda-page').then((m) => m.AgendaPage),
      },
      // Antes de agenda/:eventoId (senão "campeonatos" seria lido como id de evento).
      {
        path: 'agenda/campeonatos',
        title: 'Campeonatos · ResenhaFC',
        loadComponent: () => import('../campeonatos/campeonatos-page').then((m) => m.CampeonatosPage),
      },
      {
        path: 'agenda/campeonatos/:campeonatoId',
        title: 'Campeonato · ResenhaFC',
        loadComponent: () => import('../campeonatos/campeonato-page').then((m) => m.CampeonatoPage),
      },
      {
        path: 'agenda/:eventoId',
        title: 'Evento · ResenhaFC',
        loadComponent: () => import('../agenda/evento-page').then((m) => m.EventoPage),
      },
      {
        path: 'mural',
        title: 'Mural · ResenhaFC',
        loadComponent: () => import('../mural/mural-page').then((m) => m.MuralPage),
      },
      {
        path: 'elenco',
        title: 'Elenco · ResenhaFC',
        loadComponent: () => import('../elenco/elenco-page').then((m) => m.ElencoPage),
      },
      {
        path: 'elenco/artilharia',
        title: 'Artilharia · ResenhaFC',
        loadComponent: () => import('../estatisticas/artilharia-page').then((m) => m.ArtilhariaPage),
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
        // Qualquer membro com atleta vinculado; a tela trata quem não tem.
        path: 'financeiro/minhas',
        title: 'Minhas cobranças · ResenhaFC',
        loadComponent: () => import('../financeiro/minhas-cobrancas-page').then((m) => m.MinhasCobrancasPage),
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
        path: 'gestao/socios',
        canActivate: [diretoriaGuard],
        title: 'Sócios e colaboradores · ResenhaFC',
        loadComponent: () => import('../elenco/socios-page').then((m) => m.SociosPage),
      },
      {
        path: 'gestao/apoiadores',
        canActivate: [diretoriaGuard],
        title: 'Apoiadores · ResenhaFC',
        loadComponent: () => import('../patrocinadores/patrocinadores-page').then((m) => m.PatrocinadoresPage),
      },
      {
        path: 'gestao/esportes',
        canActivate: [diretoriaGuard],
        title: 'Esportes · ResenhaFC',
        loadComponent: () => import('../gestao/esportes-page').then((m) => m.EsportesPage),
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
