import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

// SDK modular com providers próprios: @angular/fire não suporta Angular 22 (DIRETRIZES, seção 10).
export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');

export function provideFirebase(options: FirebaseOptions): EnvironmentProviders {
  const app = initializeApp({ ...options, authDomain: dominioDoLogin(options) });
  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useValue: app },
    { provide: FIREBASE_AUTH, useFactory: () => getAuth(app) },
  ]);
}

/**
 * Login pelo mesmo domínio em que o app está aberto (web.app ou firebaseapp.com do projeto; o Hosting serve
 * /__/auth/ nos dois). Com domínio diferente, o Safari do iPhone isola o armazenamento da página de login e o
 * retorno falha ("missing initial state"). Fora do Hosting (desenvolvimento), usa o authDomain da config.
 * Cada domínio precisa estar nos URIs de redirecionamento do cliente OAuth (…/__/auth/handler).
 */
function dominioDoLogin(options: FirebaseOptions): string | undefined {
  const dominiosDoHosting = [`${options.projectId}.web.app`, `${options.projectId}.firebaseapp.com`];
  return dominiosDoHosting.includes(location.hostname) ? location.hostname : options.authDomain;
}
