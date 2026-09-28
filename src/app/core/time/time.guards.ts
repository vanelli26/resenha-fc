import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessaoService } from '../sessao/sessao.service';
import { TimeAtualService } from './time-atual.service';

// inject() sempre antes do primeiro await (fora do contexto de injeção depois dele).

/** /t/:timeId: exige acesso ao time (o adminGeral não entra em times de que não participa). */
export const timeGuard: CanActivateFn = async (route) => {
  const timeAtual = inject(TimeAtualService);
  const router = inject(Router);
  const timeId = route.paramMap.get('timeId');
  const ok = timeId !== null && (await timeAtual.entrar(timeId));
  return ok || router.createUrlTree(['/']);
};

/**
 * Guard de papel no time. O router roda os guards em paralelo: espera o timeGuard do mesmo time
 * (entrar() é idempotente) para não usar papéis do time anterior. Sem permissão, volta ao elenco.
 */
function exigePapel(permitido: (timeAtual: TimeAtualService) => boolean): CanActivateFn {
  return async (route) => {
    const timeAtual = inject(TimeAtualService);
    const router = inject(Router);
    const timeId = route.pathFromRoot.map((r) => r.paramMap.get('timeId')).find((id) => id !== null) ?? null;
    const ok = timeId !== null && (await timeAtual.entrar(timeId)) && permitido(timeAtual);
    return ok || router.createUrlTree(timeId ? ['/t', timeId, 'elenco'] : ['/']);
  };
}

/** Membros, convites, solicitações. */
export const diretoriaGuard = exigePapel((t) => t.ehDiretoria());
/** Configuração financeira, gerar cobranças, baixa. */
export const tesourariaGuard = exigePapel((t) => t.ehTesouraria());
/** Hub de gestão, cobranças e caixa (diretoria consulta; tesouraria opera). */
export const gestaoGuard = exigePapel((t) => t.ehGestao());

export const adminGeralGuard: CanActivateFn = async () => {
  const sessao = inject(SessaoService);
  const router = inject(Router);
  return (await sessao.ehAdminGeral()) || router.createUrlTree(['/']);
};
