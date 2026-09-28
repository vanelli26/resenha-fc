import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, submit, validate } from '@angular/forms/signals';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { DespesaRecorrente } from '../../models/time.model';
import { Avisos, confirmacaoPadrao } from '../../shared/avisos';
import { ReaisPipe, centavosParaReais, reaisParaCentavos } from '../../shared/dinheiro';
import { ConfigFinanceiraService, MAX_DESPESAS_RECORRENTES, novoIdConfiguracao } from './data/config-financeira.service';

interface FormDespesa {
  descricao: string;
  categoria: string;
  valor: number;
  dia: number;
}

const VAZIO: FormDespesa = { descricao: '', categoria: '', valor: 0, dia: 10 };

/** Despesas fixas do time (ex.: aluguel do campo). Cada uma é lançada no caixa uma vez por mês. */
@Component({
  selector: 'app-despesas-recorrentes',
  imports: [FormField, ButtonModule, ConfirmDialogModule, DialogModule, InputNumberModule, InputTextModule, ReaisPipe],
  providers: [ConfirmationService],
  templateUrl: './despesas-recorrentes.html',
  styleUrl: './despesas-recorrentes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DespesasRecorrentes {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(ConfigFinanceiraService);
  private readonly avisos = inject(Avisos);
  private readonly confirmacao = inject(ConfirmationService);

  protected readonly despesas = computed(() => this.timeAtual.time()?.financeiro.despesasRecorrentes ?? []);
  protected readonly podeAdicionar = computed(() => this.despesas().length < MAX_DESPESAS_RECORRENTES);
  protected readonly maximo = MAX_DESPESAS_RECORRENTES;

  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<DespesaRecorrente | null>(null);
  protected readonly salvando = signal(false);
  /** Remoção em andamento (carregando no botão Remover; Salvar fica desabilitado). */
  protected readonly removendo = signal(false);

  protected readonly modelo = signal<FormDespesa>({ ...VAZIO });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.descricao, { message: 'Informe a descrição.' });
    maxLength(p.descricao, 80, { message: 'Máximo de 80 caracteres.' });
    required(p.categoria, { message: 'Informe a categoria.' });
    maxLength(p.categoria, 40, { message: 'Máximo de 40 caracteres.' });
    validate(p.valor, ({ value }) =>
      (value() ?? 0) > 0 ? undefined : { kind: 'valor', message: 'Informe o valor.' },
    );
    required(p.dia, { message: 'Informe o dia.' });
    min(p.dia, 1, { message: 'Dia de 1 a 31.' });
    max(p.dia, 31, { message: 'Dia de 1 a 31.' });
  });

  protected adicionar(): void {
    this.emEdicao.set(null);
    this.modelo.set({ ...VAZIO });
    this.dialogAberto.set(true);
  }

  protected editar(despesa: DespesaRecorrente): void {
    this.emEdicao.set(despesa);
    this.modelo.set({
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      valor: centavosParaReais(despesa.valorCentavos),
      dia: despesa.diaVencimento,
    });
    this.dialogAberto.set(true);
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const f = this.modelo();
      const atual = this.emEdicao();
      const despesa: DespesaRecorrente = {
        id: atual?.id ?? novoIdConfiguracao(),
        descricao: f.descricao.trim(),
        categoria: f.categoria.trim(),
        valorCentavos: reaisParaCentavos(f.valor),
        diaVencimento: f.dia,
      };
      const lista = atual
        ? this.despesas().map((d) => (d.id === atual.id ? despesa : d))
        : [...this.despesas(), despesa];
      if (await this.gravar(lista, atual ? 'Despesa atualizada' : 'Despesa adicionada')) this.dialogAberto.set(false);
    });
  }

  protected remover(): void {
    const atual = this.emEdicao();
    if (!atual) return;
    this.confirmacao.confirm(
      confirmacaoPadrao({
        titulo: 'Remover despesa',
        mensagem: `Remover "${atual.descricao}"? Os lançamentos já feitos continuam no caixa.`,
        rotulo: 'Remover',
        aoConfirmar: async () => {
          const lista = this.despesas().filter((d) => d.id !== atual.id);
          if (await this.gravar(lista, 'Despesa removida', this.removendo)) this.dialogAberto.set(false);
        },
      }),
    );
  }

  private gravar(despesasRecorrentes: DespesaRecorrente[], sucesso: string, ocupado = this.salvando): Promise<boolean> {
    return this.avisos.executar(
      ocupado,
      () => this.service.atualizar({ despesasRecorrentes }),
      sucesso,
      'Não foi possível salvar',
    );
  }
}
