import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

// SDK modular com providers próprios: @angular/fire não suporta Angular 22 (DIRETRIZES, seção 10).
export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');

export function provideFirebase(options: FirebaseOptions): EnvironmentProviders {
  const app = initializeApp(options);
  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useValue: app },
    { provide: FIREBASE_AUTH, useFactory: () => getAuth(app) },
  ]);
}
