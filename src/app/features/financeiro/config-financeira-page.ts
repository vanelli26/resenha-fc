import { ChangeDetectionStrategy, Component, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { FormField, form, max, min, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { VENCIMENTOS_PADRAO, Vencimentos } from '../../models/time.model';
import { Avisos } from '../../shared/avisos';
import { NOMES_MESES } from '../../shared/competencia';
import { Voltar } from '../../shared/voltar';
import { AtletasService } from '../elenco/data/atletas.service';
import { ConfigFinanceiraService } from './data/config-financeira.service';
import { DespesasRecorrentes } from './despesas-recorrentes';
import { PlanosCobranca } from './planos-cobranca';

const mesesDe = (inicio: number) =>
  NOMES_MESES.slice(inicio - 1, inicio + 5).map((label, i) => ({ label, value: inicio + i }));

@Component({
  selector: 'app-config-financeira-page',
  imports: [FormField, ButtonModule, InputNumberModule, SelectModule, Voltar, PlanosCobranca, DespesasRecorrentes],
  templateUrl: './config-financeira-page.html',
  styleUrl: './config-financeira-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigFinanceiraPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(ConfigFinanceiraService);
  private readonly atletasService = inject(AtletasService);
  private readonly avisos = inject(Avisos);

  protected readonly mesesS1 = mesesDe(1);
  protected readonly mesesS2 = mesesDe(7);

  /** Pessoas por plano (id → total), para mostrar o uso e impedir remover plano em uso. */
  protected readonly salvando = signal(false);
  protected readonly usoPorPlano = signal<ReadonlyMap<string, number> | null>(null);

  // Recomeça do time atual ao trocar de time (a tela é reaproveitada).
  protected readonly modelo = linkedSignal<Vencimentos>(() => ({
    ...(this.timeAtual.time()?.financeiro.vencimentos ?? VENCIMENTOS_PADRAO),
  }));
  protected readonly formulario = form(this.modelo, (p) => {
    for (const dia of [p.diaMensal, p.diaSemestral]) {
      required(dia, { message: 'Informe o dia.' });
      min(dia, 1, { message: 'Dia de 1 a 31.' });
      max(dia, 31, { message: 'Dia de 1 a 31.' });
    }
  });

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.usoPorPlano.set(null);
        if (timeId) void this.carregarUso(timeId);
      });
    });
  }

  protected salvarVencimentos(): void {
    void submit(this.formulario, async () => {
      await this.avisos.executar(
        this.salvando,
        () => this.service.atualizar({ vencimentos: { ...this.modelo() } }),
        'Vencimentos salvos',
        'Não foi possível salvar',
      );
    });
  }

  private async carregarUso(timeId: string): Promise<void> {
    try {
      const cadastros = await this.atletasService.listar(timeId);
      const uso = new Map<string, number>();
      for (const a of cadastros) {
        if (a.status !== 'inativo') uso.set(a.modalidade, (uso.get(a.modalidade) ?? 0) + 1);
      }
      if (this.timeAtual.timeId() === timeId) this.usoPorPlano.set(uso);
    } catch (e) {
      this.avisos.erro('Erro ao carregar o cadastro', e);
    }
  }
}
