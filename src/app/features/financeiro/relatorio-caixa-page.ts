import { DOCUMENT, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ArrowDown } from '@primeicons/angular/arrow-down';
import { ArrowUp } from '@primeicons/angular/arrow-up';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Cobranca, Lancamento, TipoLancamento } from '../../models/financeiro.model';
import { Avisos } from '../../shared/avisos';
import { paraDataInput } from '../../shared/competencia';
import { ReaisPipe } from '../../shared/dinheiro';
import { CobrancasService } from './data/cobrancas.service';
import { LancamentosService, MAX_POR_PERIODO } from './data/lancamentos.service';
import { ExtratoCaixa } from './extrato-caixa';
import { FinanceiroAbas } from './financeiro-abas';
import { ORIGENS_CAIXA, OrigemCaixa, ROTULO_ORIGEM_CAIXA, montarRelatorio } from './relatorio-caixa';

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** `AAAA-MM-DD` → meia-noite local daquele dia. */
function inicioDoDia(valor: string): Date {
  const [ano, mes, dia] = valor.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

interface Dados {
  saldoAnterior: number;
  lancamentos: ComId<Lancamento>[];
  cobrancas: ComId<Cobranca>[];
}

/** Relatório analítico do caixa: saldo anterior, entradas, saídas e linha do tempo pela data do pagamento. */
@Component({
  selector: 'app-relatorio-caixa-page',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
    SkeletonModule,
    ArrowDown,
    ArrowUp,
    ReaisPipe,
    ExtratoCaixa,
    FinanceiroAbas,
  ],
  templateUrl: './relatorio-caixa-page.html',
  styleUrl: './relatorio-caixa-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatorioCaixaPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly lancamentosService = inject(LancamentosService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /** Período na URL (?de=AAAA-MM-DD&ate=AAAA-MM-DD), inclusive. Padrão: do dia 1 do mês até hoje. */
  readonly de = input<string>();
  readonly ate = input<string>();
  protected readonly inicio = computed(() => {
    const de = this.de();
    if (de && RE_DATA.test(de)) return de;
    const hoje = new Date();
    return paraDataInput(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  });
  protected readonly fim = computed(() => {
    const ate = this.ate();
    return ate && RE_DATA.test(ate) ? ate : paraDataInput(new Date());
  });
  protected readonly periodoInvalido = computed(() => this.inicio() > this.fim());
  /** "Saldo atual" quando o período chega até hoje; senão, o saldo na data final. */
  protected readonly ateHoje = computed(() => this.fim() >= paraDataInput(new Date()));

  protected readonly opcoesTipo: { label: string; value: TipoLancamento | null }[] = [
    { label: 'Tudo', value: null },
    { label: 'Entradas', value: 'receita' },
    { label: 'Saídas', value: 'despesa' },
  ];
  protected readonly opcoesOrigem: { label: string; value: OrigemCaixa | null }[] = [
    { label: 'Todas as formas', value: null },
    ...ORIGENS_CAIXA.map((o) => ({ label: ROTULO_ORIGEM_CAIXA[o], value: o })),
  ];
  protected readonly rotuloOrigem = ROTULO_ORIGEM_CAIXA;
  protected readonly limite = MAX_POR_PERIODO;

  protected readonly tipo = signal<TipoLancamento | null>(null);
  protected readonly origem = signal<OrigemCaixa | null>(null);
  protected readonly filtrado = computed(() => this.tipo() !== null || this.origem() !== null);
  /** Filtros escritos no cabeçalho do extrato impresso. */
  protected readonly descricaoFiltro = computed(() => {
    const tipo = this.opcoesTipo.find((o) => o.value === this.tipo())?.label ?? '';
    const origem = this.opcoesOrigem.find((o) => o.value === this.origem())?.label ?? '';
    return `${tipo} · ${origem}`;
  });
  protected readonly timeNome = computed(() => this.timeAtual.time()?.nome ?? '');
  /** Hora da emissão, atualizada ao imprimir. */
  protected readonly emitidoEm = signal(new Date());

  protected readonly dados = signal<Dados | null>(null);
  protected readonly carregando = signal(true);

  protected readonly relatorio = computed(() => {
    const dados = this.dados();
    if (!dados) return null;
    return montarRelatorio(dados.saldoAnterior, dados.lancamentos, dados.cobrancas, {
      tipo: this.tipo(),
      origem: this.origem(),
    });
  });
  /** Chegou ao teto da consulta: totais e saldo final podem estar incompletos. */
  protected readonly noLimite = computed(() => (this.dados()?.lancamentos.length ?? 0) >= this.limite);

  constructor() {
    // Recarrega ao trocar de time (tela reaproveitada) ou de período; tipo e forma filtram na tela.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const inicio = this.inicio();
      const fim = this.fim();
      untracked(() => {
        this.dados.set(null);
        if (timeId && inicio <= fim) void this.carregar(timeId, inicio, fim);
        else this.carregando.set(false);
      });
    });
  }

  protected mudarPeriodo(de: string, ate: string): void {
    if (!RE_DATA.test(de) || !RE_DATA.test(ate)) return;
    void this.router.navigate([], { queryParams: { de, ate }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected esteMes(): void {
    const hoje = new Date();
    this.mudarPeriodo(paraDataInput(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), paraDataInput(hoje));
  }

  protected mesPassado(): void {
    const hoje = new Date();
    this.mudarPeriodo(
      paraDataInput(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      paraDataInput(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    );
  }

  protected esteAno(): void {
    const hoje = new Date();
    this.mudarPeriodo(paraDataInput(new Date(hoje.getFullYear(), 0, 1)), paraDataInput(hoje));
  }

  /** Abre a impressão do sistema; nela o usuário escolhe "Salvar como PDF". */
  protected imprimir(): void {
    this.emitidoEm.set(new Date());
    // Espera o Angular desenhar a hora nova antes de abrir o diálogo.
    setTimeout(() => this.document.defaultView?.print());
  }

  private async carregar(timeId: string, de: string, ate: string): Promise<void> {
    this.carregando.set(true);
    try {
      const inicio = inicioDoDia(de);
      const fimExclusivo = inicioDoDia(ate);
      fimExclusivo.setDate(fimExclusivo.getDate() + 1);
      const [saldoAnterior, lancamentos, cobrancas] = await Promise.all([
        this.lancamentosService.saldoAntesDe(timeId, inicio),
        this.lancamentosService.listarDoPeriodo(timeId, inicio, fimExclusivo),
        this.cobrancasService.listarPagasNoPeriodo(timeId, inicio, fimExclusivo),
      ]);
      // Descarta resposta atrasada (outro time ou outro período).
      if (this.timeAtual.timeId() === timeId && this.inicio() === de && this.fim() === ate) {
        this.dados.set({ saldoAnterior, lancamentos, cobrancas });
      }
    } catch (e) {
      this.avisos.erro('Não foi possível carregar o relatório', e);
    } finally {
      this.carregando.set(false);
    }
  }
}
