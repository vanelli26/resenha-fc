import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ChevronLeft } from '@primeicons/angular/chevron-left';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import {
  ehReferenciaAnual,
  ehReferenciaSemestral,
  referenciaAnual,
  referenciaMensal,
  referenciaSemestral,
  rotuloReferencia,
  somarPeriodos,
} from '../../shared/competencia';

/** Barra ‹ período ›: mês (`AAAA-MM`), semestre (`AAAA-S1`/`S2`) ou ano (`AAAA`); emite o novo período. */
@Component({
  selector: 'app-navegador-periodo',
  imports: [ChevronLeft, ChevronRight],
  template: `
    <nav class="navegador" [attr.aria-label]="unidade().nome">
      <button type="button" class="navegador__seta" [attr.aria-label]="unidade().anterior" (click)="ir(-1)">
        <svg data-p-icon="chevron-left" [size]="18" aria-hidden="true"></svg>
      </button>
      <div class="navegador__centro">
        <strong aria-live="polite">{{ rotulo() }}</strong>
        @if (!ehAtual()) {
          <button type="button" class="navegador__hoje" (click)="mudou.emit(atual())">Voltar para hoje</button>
        }
      </div>
      <button type="button" class="navegador__seta" [attr.aria-label]="unidade().proximo" (click)="ir(1)">
        <svg data-p-icon="chevron-right" [size]="18" aria-hidden="true"></svg>
      </button>
    </nav>
  `,
  styles: `
    .navegador {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem;
      border-radius: var(--p-border-radius-lg);
      border: 1px solid var(--p-content-border-color);
      background: var(--p-content-background);
    }
    .navegador__seta {
      display: inline-grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      flex-shrink: 0;
      border: 0;
      border-radius: var(--p-border-radius-md);
      background: none;
      color: var(--p-text-color);
      cursor: pointer;

      &:hover {
        background: var(--p-content-hover-background);
      }

      &:focus-visible {
        outline: 2px solid var(--p-primary-color);
        outline-offset: -2px;
      }
    }
    .navegador__centro {
      flex: 1;
      display: grid;
      justify-items: center;
      gap: 0.125rem;
      text-align: center;
    }
    .navegador__hoje {
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-size: 0.75rem;
      color: var(--p-primary-color);
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavegadorPeriodo {
  readonly periodo = input.required<string>();
  readonly mudou = output<string>();

  protected readonly unidade = computed(() => {
    const p = this.periodo();
    if (ehReferenciaAnual(p)) return { nome: 'Ano', anterior: 'Ano anterior', proximo: 'Próximo ano', hoje: referenciaAnual };
    if (ehReferenciaSemestral(p)) {
      return { nome: 'Semestre', anterior: 'Semestre anterior', proximo: 'Próximo semestre', hoje: referenciaSemestral };
    }
    return { nome: 'Mês', anterior: 'Mês anterior', proximo: 'Próximo mês', hoje: referenciaMensal };
  });
  /** Período de hoje, do mesmo tipo (mês, semestre ou ano) do que está na tela. */
  protected readonly atual = computed(() => this.unidade().hoje(new Date()));
  protected readonly rotulo = computed(() => rotuloReferencia(this.periodo()));
  protected readonly ehAtual = computed(() => this.periodo() === this.atual());

  protected ir(delta: number): void {
    this.mudou.emit(somarPeriodos(this.periodo(), delta));
  }
}
