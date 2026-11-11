import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import {
  Cobranca,
  FORMAS_DA_BAIXA,
  FORMAS_PAGAMENTO,
  FormaPagamento,
  formaDaObservacao,
} from '../../models/financeiro.model';
import { Avisos, confirmacaoPadrao } from '../../shared/avisos';
import {
  deDataInput,
  ehReferenciaMensal,
  ehReferenciaSemestral,
  intervaloDoPeriodo,
  paraDataInput,
  referenciaMensal,
  referenciaSemestral,
} from '../../shared/competencia';
import { abrirWhatsApp, numeroWhatsApp } from '../../shared/compartilhar';
import { ReaisPipe } from '../../shared/dinheiro';
import { ROTULO_FORMA_PAGAMENTO } from '../../shared/rotulos';
import { CobrancasService, competenciaDaCobranca, nomeDaCobranca } from './data/cobrancas.service';
import { AtletasService } from '../elenco/data/atletas.service';
import { FinanceiroAbas } from './financeiro-abas';
import { itemDaCobranca, mensagemDeCobranca } from './mensagem-cobranca';
import { NavegadorPeriodo } from './navegador-periodo';
import { SituacaoCobranca, SituacaoCobrancaTag, situacaoDaCobranca } from './situacao-cobranca';

/**
 * Visão da lista: o que vence no mês/semestre escolhido, todas as pendentes (qualquer período)
 * ou só as pendentes já vencidas.
 */
type Visao = 'mes' | 'semestre' | 'aberto' | 'vencidas';

const ROTULO_VISAO: Record<Visao, string> = {
  mes: 'Por mês',
  semestre: 'Por semestre',
  aberto: 'Em aberto',
  vencidas: 'Vencidas',
};
/** Visões sem período (pendentes de qualquer competência). */
const VISOES_SEM_PERIODO: readonly Visao[] = ['aberto', 'vencidas'];

interface CobrancaVisao {
  cobranca: ComId<Cobranca>;
  situacao: SituacaoCobranca;
  vencimento: Date;
  rotulo: string;
  /** Pendente de quem tem celular cadastrado: mostra "WhatsApp". */
  whatsApp: boolean;
}

@Component({
  selector: 'app-cobrancas-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
    SkeletonModule,
    ReaisPipe,
    SituacaoCobrancaTag,
    NavegadorPeriodo,
    FinanceiroAbas,
  ],
  providers: [ConfirmationService],
  templateUrl: './cobrancas-page.html',
  styleUrl: './cobrancas-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CobrancasPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly avisos = inject(Avisos);
  private readonly confirmacao = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly atletasService = inject(AtletasService);
  private readonly locale = inject(LOCALE_ID);

  // Período e visão ficam na URL (?periodo=AAAA-MM | AAAA-S1 & visao=aberto|vencidas): voltar do celular e links funcionam.
  readonly periodo = input<string>();
  readonly visao = input<string>();

  protected readonly ehTesouraria = this.timeAtual.ehTesouraria;
  protected readonly timeId = this.timeAtual.timeId;

  /** Navegação por período conforme os planos do time: só semestrais → semestres; mensais (ou nenhum) → meses. */
  private readonly visoesPeriodo = computed<Visao[]>(() => {
    const periodicidades = this.timeAtual.periodicidades();
    const semestral = periodicidades.includes('semestral');
    const mensal = periodicidades.includes('mensal') || !semestral;
    const visoes: Visao[] = [];
    if (mensal) visoes.push('mes');
    if (semestral) visoes.push('semestre');
    return visoes;
  });
  protected readonly opcoesVisao = computed(() => {
    const visoes: Visao[] = [...this.visoesPeriodo(), ...VISOES_SEM_PERIODO];
    return visoes.map((value) => ({ value, label: ROTULO_VISAO[value] }));
  });

  protected readonly visaoAtual = computed<Visao>(() => {
    const visao = this.visao();
    if (visao === 'aberto' || visao === 'vencidas') return visao;
    const doLink = ehReferenciaSemestral(this.periodo()) ? 'semestre' : ehReferenciaMensal(this.periodo()) ? 'mes' : null;
    return doLink && this.visoesPeriodo().includes(doLink) ? doLink : this.visoesPeriodo()[0];
  });
  /** Mês ou semestre na tela (da URL, se for do tipo da visão; senão o de hoje). */
  protected readonly periodoAtual = computed(() => {
    const periodo = this.periodo();
    if (this.visaoAtual() === 'semestre') {
      return ehReferenciaSemestral(periodo) ? periodo : referenciaSemestral(new Date());
    }
    return ehReferenciaMensal(periodo) ? periodo : referenciaMensal(new Date());
  });
  /** Mês ou semestre (navegação de período e filtro de forma); as outras visões só têm pendentes. */
  protected readonly porPeriodo = computed(() => !VISOES_SEM_PERIODO.includes(this.visaoAtual()));
  /** Chave única do que está na tela: 'aberto', 'vencidas' ou o período. */
  private readonly filtro = computed(() => (this.porPeriodo() ? this.periodoAtual() : this.visaoAtual()));
  protected readonly busca = signal('');

  /**
   * Filtro das pagas pela forma (deduzida da observação): ex.: total pago direto no campo, a descontar do aluguel.
   * Não vale nas visões "Em aberto" e "Vencidas" (só pendentes).
   */
  protected readonly formaFiltro = signal<FormaPagamento | null>(null);
  protected readonly formaAtiva = computed(() => (this.porPeriodo() ? this.formaFiltro() : null));
  protected readonly rotuloForma = ROTULO_FORMA_PAGAMENTO;
  protected readonly opcoesForma = [
    { label: 'Todas as formas', value: null },
    ...FORMAS_PAGAMENTO.map((f) => ({ label: ROTULO_FORMA_PAGAMENTO[f], value: f })),
  ];

  private readonly cobrancas = signal<ComId<Cobranca>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly processando = signal(false);
  /** Número de WhatsApp (wa.me) e nome de cada cadastro com telefone válido, para cobrar direto. */
  private readonly contatos = signal<ReadonlyMap<string, { numero: string; nome: string }>>(new Map());

  /** Cobrança com ação em andamento (carregando no botão dela). */
  protected readonly emAndamento = signal<string | null>(null);

  protected readonly lista = computed<CobrancaVisao[]>(() => {
    const hoje = new Date();
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const forma = this.formaAtiva();
    return this.cobrancas()
      // Canceladas não aparecem (não contam no "a receber" nem no recebido).
      .filter((c) => c.status !== 'cancelado')
      .filter((c) => !termo || c.atletaNome.toLocaleLowerCase('pt-BR').includes(termo))
      .filter((c) => !forma || (c.status === 'pago' && formaDaObservacao(c.observacao) === forma))
      .map((c) => ({
        cobranca: c,
        situacao: situacaoDaCobranca(c, hoje),
        vencimento: c.vencimento.toDate(),
        rotulo: `${nomeDaCobranca(c)} · ${competenciaDaCobranca(c)}`,
        whatsApp: c.status === 'pendente' && this.contatos().has(c.atletaId),
      }))
      .sort(
        (a, b) =>
          a.vencimento.getTime() - b.vencimento.getTime() ||
          a.cobranca.atletaNome.localeCompare(b.cobranca.atletaNome, 'pt-BR'),
      );
  });

  protected readonly resumo = computed(() => {
    let aReceber = 0;
    let recebido = 0;
    let atrasadas = 0;
    let pagamentos = 0;
    for (const { cobranca, situacao } of this.lista()) {
      if (situacao === 'pago') {
        recebido += cobranca.valorCentavos;
        pagamentos++;
      }
      if (situacao === 'pendente' || situacao === 'atrasado') aReceber += cobranca.valorCentavos;
      if (situacao === 'atrasado') atrasadas++;
    }
    return { aReceber, recebido, atrasadas, pagamentos };
  });

  // Diálogo de baixa.
  protected readonly emBaixa = signal<ComId<Cobranca> | null>(null);
  protected readonly dataPagamento = signal('');
  protected readonly observacao = signal('');
  protected readonly formasDaBaixa = FORMAS_DA_BAIXA;
  /** Forma que a observação digitada indica (marca o botão correspondente). */
  protected readonly formaDaBaixa = computed(() => formaDaObservacao(this.observacao()));
  protected readonly baixaAberta = computed(() => this.emBaixa() !== null);

  constructor() {
    // Recarrega ao trocar de time (tela reaproveitada), de mês ou de visão.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const filtro = this.filtro();
      untracked(() => {
        this.cobrancas.set([]);
        this.emBaixa.set(null);
        if (timeId) void this.carregar(timeId, filtro);
      });
    });
    // Telefones do cadastro: uma leitura por time, só para quem cobra.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const cobra = this.ehTesouraria();
      untracked(() => {
        this.contatos.set(new Map());
        if (timeId && cobra) void this.carregarContatos(timeId);
      });
    });
  }

  protected irParaPeriodo(periodo: string): void {
    this.atualizarUrl({ periodo, visao: null });
  }

  /** Ao trocar entre mês e semestre, abre o período de hoje do novo tipo. */
  protected trocarVisao(visao: Visao | null): void {
    if (visao === 'aberto' || visao === 'vencidas') this.atualizarUrl({ visao });
    else if (visao === 'semestre') this.atualizarUrl({ visao: null, periodo: referenciaSemestral(new Date()) });
    else if (visao === 'mes') this.atualizarUrl({ visao: null, periodo: referenciaMensal(new Date()) });
  }

  /** Só troca a URL (sem empilhar histórico a cada clique); os inputs recarregam a lista. */
  private atualizarUrl(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected abrirBaixa(cobranca: ComId<Cobranca>): void {
    this.dataPagamento.set(paraDataInput(new Date()));
    this.observacao.set('');
    this.emBaixa.set(cobranca);
  }

  /** Botão da forma: escreve o rótulo na observação (texto igual sempre, para o filtro); dá para completar depois. */
  protected escolherForma(forma: FormaPagamento): void {
    this.observacao.set(ROTULO_FORMA_PAGAMENTO[forma]);
  }

  protected fecharBaixa(visivel: boolean): void {
    if (!visivel) this.emBaixa.set(null);
  }

  protected async confirmarBaixa(): Promise<void> {
    const cobranca = this.emBaixa();
    const uid = this.auth.usuario()?.uid;
    if (!cobranca || !uid || !this.dataPagamento()) return;
    const observacao = this.observacao().trim().slice(0, 200);
    await this.executar(
      cobranca.id,
      (timeId) => this.cobrancasService.darBaixa(timeId, cobranca, { pagoEm: deDataInput(this.dataPagamento()), observacao, uid }),
      'Pagamento registrado',
    );
    this.emBaixa.set(null);
  }

  protected estornar(cobranca: ComId<Cobranca>): void {
    this.confirmar(
      `Estornar o pagamento de ${cobranca.atletaNome}? A cobrança volta a pendente e a receita sai do caixa.`,
      'Estornar',
      () =>
        this.executar(cobranca.id, (timeId) => this.cobrancasService.estornar(timeId, cobranca.id), 'Pagamento estornado'),
    );
  }

  protected cancelar(cobranca: ComId<Cobranca>): void {
    this.confirmar(
      `Cancelar a cobrança de ${cobranca.atletaNome}? Ela deixa de contar como pendente e sai da lista.`,
      'Cancelar cobrança',
      () =>
        this.executar(
          cobranca.id,
          (timeId) => this.cobrancasService.definirCancelada(timeId, cobranca.id, true),
          'Cobrança cancelada',
        ),
    );
  }

  private confirmar(mensagem: string, rotulo: string, acao: () => Promise<void>): void {
    this.confirmacao.confirm(
      confirmacaoPadrao({
        titulo: 'Confirmar',
        mensagem: mensagem,
        rotulo: rotulo,
        aoConfirmar: () => void acao(),
      }),
    );
  }

  private async executar(cobrancaId: string, acao: (timeId: string) => Promise<void>, sucesso: string): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.emAndamento.set(cobrancaId);
    try {
      if (await this.avisos.executar(this.processando, () => acao(timeId), sucesso)) {
        await this.carregar(timeId, this.filtro());
      }
    } finally {
      this.emAndamento.set(null);
    }
  }

  /** Abre a conversa da pessoa com a cobrança tocada e as outras pendentes dela já carregadas na tela. */
  protected enviarWhatsApp(cobranca: ComId<Cobranca>): void {
    const contato = this.contatos().get(cobranca.atletaId);
    const timeId = this.timeAtual.timeId();
    if (!contato || !timeId) return;
    const pendentes = this.cobrancas().filter((c) => c.atletaId === cobranca.atletaId && c.status === 'pendente');
    const time = this.timeAtual.time();
    const hoje = new Date();
    const texto = mensagemDeCobranca({
      timeNome: time?.nome ?? '',
      nome: contato.nome || cobranca.atletaNome,
      itens: (pendentes.length > 0 ? pendentes : [cobranca]).map((c) => itemDaCobranca(c, hoje)),
      link: `${location.origin}/t/${timeId}/financeiro/minhas`,
      locale: this.locale,
      modelo: time?.financeiro.mensagemCobranca,
      chavePix: time?.financeiro.chavePix,
    });
    abrirWhatsApp(texto, contato.numero);
  }

  private async carregarContatos(timeId: string): Promise<void> {
    try {
      const cadastros = await this.atletasService.listar(timeId);
      const contatos = new Map<string, { numero: string; nome: string }>();
      for (const a of cadastros) {
        const numero = numeroWhatsApp(a.telefone);
        if (numero) contatos.set(a.id, { numero, nome: a.apelido || a.nome });
      }
      if (this.timeAtual.timeId() === timeId) this.contatos.set(contatos);
    } catch {
      // Complemento: sem os telefones, só não aparece o botão do WhatsApp.
    }
  }

  private async carregar(timeId: string, filtro: string): Promise<void> {
    this.carregando.set(true);
    try {
      const dados =
        filtro === 'aberto'
          ? await this.cobrancasService.listarEmAberto(timeId)
          : filtro === 'vencidas'
            ? await this.cobrancasService.listarVencidas(timeId, inicioDeHoje())
            : await this.listarDoPeriodo(timeId, filtro);
      // Descarta resposta atrasada (outro time ou outro filtro).
      if (this.timeAtual.timeId() === timeId && this.filtro() === filtro) this.cobrancas.set(dados);
    } catch (e) {
      this.avisos.erro('Erro ao carregar cobranças', e);
    } finally {
      this.carregando.set(false);
    }
  }

  private listarDoPeriodo(timeId: string, periodo: string) {
    const { inicio, fim } = intervaloDoPeriodo(periodo);
    return this.cobrancasService.listarPorVencimento(timeId, inicio, fim);
  }
}

/** Vencida = pendente com vencimento antes de hoje (mesma regra do "atrasado" da situação). */
function inicioDeHoje(): Date {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}
