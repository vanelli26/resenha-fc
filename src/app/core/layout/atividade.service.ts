import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

/**
 * Atividade em andamento no app (DIRETRIZES 6.2): troca de tela (download da tela + guards) e escritas
 * feitas via `Avisos.executar`. Enquanto houver alguma, a barra fina do topo (`BarraAtividade`) aparece.
 */
@Injectable({ providedIn: 'root' })
export class Atividade {
  private readonly router = inject(Router);
  private readonly pendentes = signal(0);
  private navegando: (() => void) | null = null;

  readonly ocupado = computed(() => this.pendentes() > 0);

  /** Marca o início de uma atividade; chame a função devolvida ao terminar (uma vez só). */
  iniciar(): () => void {
    this.pendentes.update((n) => n + 1);
    let terminou = false;
    return () => {
      if (terminou) return;
      terminou = true;
      this.pendentes.update((n) => Math.max(0, n - 1));
    };
  }

  async acompanhar<T>(tarefa: () => Promise<T>): Promise<T> {
    const terminar = this.iniciar();
    try {
      return await tarefa();
    } finally {
      terminar();
    }
  }

  /** Liga a barra durante cada navegação (inclui carregar a tela e os guards que leem o Firestore). */
  acompanharNavegacao(): void {
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        this.navegando?.();
        this.navegando = this.iniciar();
      } else if (
        evento instanceof NavigationEnd ||
        evento instanceof NavigationCancel ||
        evento instanceof NavigationError
      ) {
        this.navegando?.();
        this.navegando = null;
      }
    });
  }
}
