import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { pt_BR } from 'primelocale/js/pt_BR.js';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideFirebase } from './core/firebase/firebase.providers';
import { AtualizacaoApp } from './core/pwa/atualizacao-app.service';
import { InstalacaoApp } from './core/pwa/instalacao-app.service';
import { AppPreset } from './core/theme/app-theme';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    providePrimeNG({
      theme: { preset: AppPreset, options: { darkModeSelector: '.app-dark' } },
      translation: pt_BR,
      license: environment.primeNgLicense,
    }),
    provideFirebase(environment.firebase),
    MessageService,
    // PWA (DIRETRIZES 6.3): service worker só no build de produção; registra quando o app estabiliza.
    // sw-principal.js deixa as requisições de outras origens (Firebase) fora do worker do Angular.
    provideServiceWorker('sw-principal.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Cedo: o pedido de instalação pode chegar ainda na tela de login.
    provideAppInitializer(() => {
      inject(InstalacaoApp).iniciar();
      inject(AtualizacaoApp).iniciar();
    }),
  ],
};
