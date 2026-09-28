import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Atividade } from './atividade.service';

/**
 * Barra fina e animada no topo enquanto o app trabalha (troca de tela, salvar). Aparece só depois de
 * 150 ms, para não piscar em ações rápidas.
 */
@Component({
  selector: 'app-barra-atividade',
  template: `
    @if (atividade.ocupado()) {
      <div class="barra" role="progressbar" aria-label="Carregando"><span></span></div>
    }
  `,
  styles: `
    .barra {
      position: fixed;
      inset: 0 0 auto;
      z-index: 2000;
      height: 3px;
      overflow: hidden;
      opacity: 0;
      animation: aparecer 0.15s linear 0.15s forwards;

      span {
        position: absolute;
        inset: 0 auto 0 0;
        width: 40%;
        background: var(--p-primary-color);
        animation: correr 1.1s ease-in-out infinite;
      }
    }

    @keyframes aparecer {
      to {
        opacity: 1;
      }
    }

    @keyframes correr {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .barra span {
        width: 100%;
        animation: none;
        opacity: 0.6;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraAtividade {
  protected readonly atividade = inject(Atividade);
}
