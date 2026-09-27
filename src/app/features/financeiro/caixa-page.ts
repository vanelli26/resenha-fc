import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ArrowDown } from '@primeicons/angular/arrow-down';
import { ArrowUp } from '@primeicons/angular/arrow-up';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Lancamento, TipoLancamento } from '../../models/financeiro.model';
import { DespesaRecorrente } from '../../models/time.model';
import {
  deDataInput,
  ehReferenciaMensal,
  intervaloDoPeriodo,
  paraDataInput,
  referenciaMensal,
  vencimentoMensal,
} from '../../shared/competencia';
import { ReaisPipe, centavosParaReais, reaisParaCentavos } from '../../shared/dinheiro';
import { mensagemDeErro } from '../../shared/erros';
import { ROTULO_TIPO_COBRANCA } from '../../shared/rotulos';
import { LancamentosService, ehLancamentoDeBaixa, idLancamentoRecorrente } from './data/lancamentos.service';
import { FinanceiroAbas } from './financeiro-abas';
import { NavegadorPeriodo } from './navegador-periodo';

interface FormLancamento {
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
}

interface RecorrenteDoMes {
  despesa: DespesaRecorrente;
  lancada: boolean;
}

@Component({
  selector: 'app-caixa-page',
  imports: [
    DatePipe,
    FormField,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectButtonModule,
    SkeletonModule,
    TagModule,
    ArrowDown,
    ArrowUp,
    ReaisPipe,
    FinanceiroAbas,
    NavegadorPeriodo,
  ],
  providers: [ConfirmationService],
  templateUrl: './caixa-page.html',
  styleUrl: './caixa-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaixaPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly lancamentosService = inject(LancamentosService);
  private readonly mensagens = inject(MessageService);
  private readonly confirmacao = inject(ConfirmationService);
  private readonly router = inject(Router);

  /** Mês na URL (?periodo=AAAA-MM). O caixa é sempre mensal. */
  readonly periodo = input<string>();
  protected readonly mes = computed(() => {
    const periodo = this.periodo();
    return ehReferenciaMensal(periodo) ? periodo : referenciaMensal(new Date());
  });

  protected readonly ehTesouraria = this.timeAtual.ehTesouraria;
  protected readonly ehDeBaixa = ehLancamentoDeBaixa;
  protected readonly opcoesTipo = [
    { label: 'Despesa', value: 'despesa' },
    { label: 'Receita', value: 'receita' },
  ];

  protected readonly saldo = signal<number | null>(null);
  protected readonly lancamentos = signal<ComId<Lancamento>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly processando = signal(false);

  protected readonly resumo = computed(() => {
    let receitas = 0;
    let despesas = 0;
    for (const l of this.lancamentos()) {
      if (l.tipo === 'receita') receitas += l.valorCentavos;
      else despesas += l.valorCentavos;
    }
    return { receitas, despesas, resultado: receitas - despesas };
  });

  protected readonly recorrentes = computed<RecorrenteDoMes[]>(() => {
    const ids = new Set(this.lancamentos().map((l) => l.id));
    const mes = this.mes();
    return (this.timeAtual.time()?.financeiro.despesasRecorrentes ?? []).map((despesa) => ({
      despesa,
      lancada: ids.has(idLancamentoRecorrente(despesa.id, mes)),
    }));
  });

  /** Sugestões de categoria (texto livre): as já usadas no mês, as das recorrentes, os planos e os tipos antigos. */
  protected readonly categorias = computed(() => {
    const todas = [
      ...this.lancamentos().map((l) => l.categoria),
      ...(this.timeAtual.time()?.financeiro.despesasRecorrentes ?? []).map((d) => d.categoria),
      ...this.timeAtual.planos().map((p) => p.nome),
      ...Object.values(ROTULO_TIPO_COBRANCA),
    ];
    return [...new Set(todas)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  // Diálogo de lançamento (novo ou edição).
  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<ComId<Lancamento> | null>(null);
  protected readonly modelo = signal<FormLancamento>(this.vazio());
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.descricao, { message: 'Informe a descrição.' });
    maxLength(p.descricao, 120, { message: 'Máximo de 120 caracteres.' });
    required(p.categoria, { message: 'Informe a categoria.' });
    maxLength(p.categoria, 40, { message: 'Máximo de 40 caracteres.' });
    validate(p.valor, ({ value }) => ((value() ?? 0) > 0 ? undefined : { kind: 'valor', message: 'Informe o valor.' }));
    required(p.data, { message: 'Informe a data.' });
  });

  constructor() {
    // Recarrega ao trocar de time (tela reaproveitada) ou de mês.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const mes = this.mes();
      untracked(() => {
        this.lancamentos.set([]);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar(timeId, mes);
      });
    });
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.saldo.set(null);
        if (timeId) void this.carregarSaldo(timeId);
      });
    });
  }

  protected irParaMes(periodo: string): void {
    void this.router.navigate([], { queryParams: { periodo }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected novo(): void {
    this.emEdicao.set(null);
    this.modelo.set(this.vazio());
    this.dialogAberto.set(true);
  }

  protected editar(lancamento: ComId<Lancamento>): void {
    if (!this.ehTesouraria() || ehLancamentoDeBaixa(lancamento.id)) return;
    this.emEdicao.set(lancamento);
    this.modelo.set({
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      categoria: lancamento.categoria,
      valor: centavosParaReais(lancamento.valorCentavos),
      data: paraDataInput(lancamento.data.toDate()),
    });
    this.dialogAberto.set(true);
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const f = this.modelo();
      const dados = {
        tipo: f.tipo,
        descricao: f.descricao.trim(),
        categoria: this.normalizarCategoria(f.categoria),
        valorCentavos: reaisParaCentavos(f.valor),
        data: deDataInput(f.data),
      };
      const atual = this.emEdicao();
      const uid = this.auth.usuario()?.uid;
      if (!uid) return;
      const ok = await this.executar(
        (timeId) =>
          atual
            ? this.lancamentosService.atualizar(timeId, atual.id, dados)
            : this.lancamentosService.criar(timeId, dados, uid),
        atual ? 'Lançamento atualizado' : 'Lançamento registrado',
      );
      if (ok) this.dialogAberto.set(false);
    });
  }

  protected excluir(): void {
    const atual = this.emEdicao();
    if (!atual) return;
    this.confirmacao.confirm({
      header: 'Excluir lançamento',
      message: `Excluir "${atual.descricao}" do caixa?`,
      acceptLabel: 'Excluir',
      rejectLabel: 'Voltar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { text: true },
      accept: async () => {
        const ok = await this.executar((timeId) => this.lancamentosService.excluir(timeId, atual.id), 'Lançamento excluído');
        if (ok) this.dialogAberto.set(false);
      },
    });
  }

  protected async lancarRecorrente(despesa: DespesaRecorrente): Promise<void> {
    const uid = this.auth.usuario()?.uid;
    const mes = this.mes();
    if (!uid) return;
    await this.executar(
      (timeId) =>
        this.lancamentosService.lancarRecorrente(timeId, despesa, mes, vencimentoMensal(mes, despesa.diaVencimento), uid),
      `${despesa.descricao} lançada`,
    );
  }

  /** Reaproveita a grafia de uma categoria já usada ("campo" → "Campo"), evitando variações no relatório. */
  private normalizarCategoria(valor: string): string {
    const texto = valor.trim();
    const existente = this.categorias().find((c) => c.localeCompare(texto, 'pt-BR', { sensitivity: 'base' }) === 0);
    return existente ?? texto;
  }

  /** Data padrão: hoje, se o mês na tela é o atual; senão o 1º dia do mês na tela. */
  private vazio(): FormLancamento {
    const mes = this.mes();
    const hoje = new Date();
    const data = mes === referenciaMensal(hoje) ? hoje : intervaloDoPeriodo(mes).inicio;
    return { tipo: 'despesa', descricao: '', categoria: '', valor: 0, data: paraDataInput(data) };
  }

  private async executar(acao: (timeId: string) => Promise<void>, sucesso: string): Promise<boolean> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return false;
    this.processando.set(true);
    try {
      await acao(timeId);
      this.mensagens.add({ severity: 'success', summary: sucesso });
      await Promise.all([this.carregar(timeId, this.mes()), this.carregarSaldo(timeId)]);
      return true;
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível concluir', detail: mensagemDeErro(e) });
      return false;
    } finally {
      this.processando.set(false);
    }
  }

  private async carregar(timeId: string, mes: string): Promise<void> {
    this.carregando.set(true);
    try {
      const { inicio, fim } = intervaloDoPeriodo(mes);
      const dados = await this.lancamentosService.listarDoPeriodo(timeId, inicio, fim);
      // Descarta resposta atrasada (outro time ou outro mês).
      if (this.timeAtual.timeId() === timeId && this.mes() === mes) this.lancamentos.set(dados);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar o caixa', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarSaldo(timeId: string): Promise<void> {
    try {
      const saldo = await this.lancamentosService.saldo(timeId);
      if (this.timeAtual.timeId() === timeId) this.saldo.set(saldo);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao calcular o saldo', detail: mensagemDeErro(e) });
    }
  }
}
