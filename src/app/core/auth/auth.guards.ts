import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Rotas que exigem login. Guarda a URL pedida (ex.: link de convite) para voltar depois do login. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.aguardarEstadoInicial();
  const queryParams = state.url === '/' ? {} : { voltar: state.url };
  return auth.autenticado() || router.createUrlTree(['/login'], { queryParams });
};

/** Rotas só para visitante (ex.: login). Usuário logado vai para o início. */
export const visitanteGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.aguardarEstadoInicial();
  return !auth.autenticado() || router.createUrlTree(['/']);
};
