import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReaisPipe } from '../../shared/dinheiro';
import { ROTULO_ORIGEM_CAIXA, RelatorioCaixa } from './relatorio-caixa';

/**
 * Extrato do caixa no estilo bancário, só para impressão/PDF (a tela usa a linha do tempo em cartões).
 * Apresentação pura: recebe o relatório já montado.
 */
@Component({
  selector: 'app-extrato-caixa',
  imports: [DatePipe, ReaisPipe],
  templateUrl: './extrato-caixa.html',
  styleUrl: './extrato-caixa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtratoCaixa {
  readonly relatorio = input.required<RelatorioCaixa>();
  readonly timeNome = input.required<string>();
  /** `AAAA-MM-DD`. */
  readonly inicio = input.required<string>();
  readonly fim = input.required<string>();
  readonly filtros = input.required<string>();
  readonly filtrado = input.required<boolean>();
  readonly emitidoEm = input.required<Date>();
  /** "Saldo atual" (período até hoje) ou "Saldo final". */
  readonly rotuloSaldoFinal = input.required<string>();

  protected readonly rotuloOrigem = ROTULO_ORIGEM_CAIXA;
}
