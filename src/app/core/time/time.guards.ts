import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessaoService } from '../sessao/sessao.service';
import { TimeAtualService } from './time-atual.service';

// inject() sempre antes do primeiro await (fora do contexto de injeção depois dele).

/** /t/:timeId: exige acesso ao time (ou adminGeral). */
export const timeGuard: CanActivateFn = async (route) => {
  const timeAtual = inject(TimeAtualService);
  const router = inject(Router);
  const timeId = route.paramMap.get('timeId');
  const ok = timeId !== null && (await timeAtual.entrar(timeId));
  return ok || router.createUrlTree(['/']);
};

/**
 * Telas de gestão do time (membros, convites, solicitações). O router roda os guards em paralelo:
 * espera o timeGuard do mesmo time (entrar() é idempotente) para não usar papéis do time anterior.
 */
export const diretoriaGuard: CanActivateFn = async (route) => {
  const timeAtual = inject(TimeAtualService);
  const router = inject(Router);
  const timeId = route.pathFromRoot.map((r) => r.paramMap.get('timeId')).find((id) => id !== null) ?? null;
  const ok = timeId !== null && (await timeAtual.entrar(timeId)) && timeAtual.ehDiretoria();
  return ok || router.createUrlTree(timeId ? ['/t', timeId, 'elenco'] : ['/']);
};

export const adminGeralGuard: CanActivateFn = async () => {
  const sessao = inject(SessaoService);
  const router = inject(Router);
  return (await sessao.ehAdminGeral()) || router.createUrlTree(['/']);
};
