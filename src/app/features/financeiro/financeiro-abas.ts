import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { AbaSecao, AbasSecao } from '../../shared/abas-secao';

/** Alternância entre as telas do financeiro da gestão (Cobranças | Caixa | Relatório | Minhas), mantendo o período da URL. */
@Component({
  selector: 'app-financeiro-abas',
  imports: [AbasSecao],
  template: `<app-abas-secao rotulo="Financeiro" [abas]="abas()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceiroAbas {
  private readonly timeAtual = inject(TimeAtualService);

  protected readonly abas = computed<AbaSecao[]>(() => {
    const base = ['/t', this.timeAtual.timeId(), 'financeiro'];
    return [
      { rotulo: 'Cobranças', link: [...base, 'cobrancas'], manterParametros: true },
      { rotulo: 'Caixa', link: [...base, 'caixa'], manterParametros: true },
      // Período próprio (?de=&ate=): não herda o mês das outras abas.
      { rotulo: 'Relatório', link: [...base, 'relatorio'] },
      // Quem gere e também joga vê as próprias cobranças na terceira aba.
      ...(this.timeAtual.acesso()?.atletaId ? [{ rotulo: 'Minhas', link: [...base, 'minhas'] }] : []),
    ];
  });
}
