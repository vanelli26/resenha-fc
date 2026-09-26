import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

const CHAVE_STORAGE = 'resenhafc.modoEscuro';
const CLASSE_ESCURO = 'app-dark';

// Modo escuro é o padrão (DIRETRIZES 6.1); a preferência do usuário fica no navegador.
@Injectable({ providedIn: 'root' })
export class ModoTemaService {
  private readonly document = inject(DOCUMENT);
  private readonly _escuro = signal(this.lerPreferencia());

  readonly escuro = this._escuro.asReadonly();

  constructor() {
    effect(() => {
      const escuro = this._escuro();
      this.document.documentElement.classList.toggle(CLASSE_ESCURO, escuro);
      this.salvarPreferencia(escuro);
    });
  }

  alternar(): void {
    this._escuro.update((escuro) => !escuro);
  }

  private lerPreferencia(): boolean {
    try {
      return localStorage.getItem(CHAVE_STORAGE) !== 'false';
    } catch {
      return true;
    }
  }

  private salvarPreferencia(escuro: boolean): void {
    try {
      localStorage.setItem(CHAVE_STORAGE, String(escuro));
    } catch {
      // Storage indisponível (ex.: navegação privada): mantém só em memória.
    }
  }
}
