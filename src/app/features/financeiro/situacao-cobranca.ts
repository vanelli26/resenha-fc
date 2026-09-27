import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Check } from '@primeicons/angular/check';
import { Clock } from '@primeicons/angular/clock';
import { ExclamationCircle } from '@primeicons/angular/exclamation-circle';
import { Times } from '@primeicons/angular/times';
import { TagModule } from 'primeng/tag';
import { Cobranca, StatusCobranca } from '../../models/financeiro.model';

/** Status gravado + "atrasado", derivado na UI (pendente e vencimento antes de hoje). */
export type SituacaoCobranca = StatusCobranca | 'atrasado';

export function situacaoDaCobranca(cobranca: Pick<Cobranca, 'status' | 'vencimento'>, hoje = new Date()): SituacaoCobranca {
  if (cobranca.status !== 'pendente') return cobranca.status;
  const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return cobranca.vencimento.toDate() < inicioDoDia ? 'atrasado' : 'pendente';
}

export const ROTULO_SITUACAO: Record<SituacaoCobranca, string> = {
  pendente: 'Pendente',
  atrasado: 'Atrasado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const SEVERIDADE: Record<SituacaoCobranca, 'success' | 'warn' | 'danger' | 'secondary'> = {
  pago: 'success',
  pendente: 'warn',
  atrasado: 'danger',
  cancelado: 'secondary',
};

/** Selo de status com ícone além da cor (DIRETRIZES 6.1): a cor "pendente" pode coincidir com a do time. */
@Component({
  selector: 'app-situacao-cobranca',
  imports: [TagModule, Check, Clock, ExclamationCircle, Times],
  template: `
    <p-tag [value]="rotulo()" [severity]="severidade()">
      <ng-template #icon>
        @switch (situacao()) {
          @case ('pago') {
            <svg data-p-icon="check" [size]="12" aria-hidden="true"></svg>
          }
          @case ('pendente') {
            <svg data-p-icon="clock" [size]="12" aria-hidden="true"></svg>
          }
          @case ('atrasado') {
            <svg data-p-icon="exclamation-circle" [size]="12" aria-hidden="true"></svg>
          }
          @case ('cancelado') {
            <svg data-p-icon="times" [size]="12" aria-hidden="true"></svg>
          }
        }
      </ng-template>
    </p-tag>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SituacaoCobrancaTag {
  readonly situacao = input.required<SituacaoCobranca>();

  protected readonly rotulo = computed(() => ROTULO_SITUACAO[this.situacao()]);
  protected readonly severidade = computed(() => SEVERIDADE[this.situacao()]);
}
