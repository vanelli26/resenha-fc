import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Cobranca } from '../../models/financeiro.model';
import {
  deDataInput,
  ehReferenciaMensal,
  ehReferenciaSemestral,
  intervaloDoPeriodo,
  paraDataInput,
  referenciaMensal,
  referenciaSemestral,
} from '../../shared/competencia';
import { ReaisPipe } from '../../shared/dinheiro';
import { mensagemDeErro } from '../../shared/erros';
import { CobrancasService, competenciaDaCobranca, nomeDaCobranca } from './data/cobrancas.service';
import { FinanceiroAbas } from './financeiro-abas';
import { NavegadorPeriodo } from './navegador-periodo';
import { SituacaoCobranca, SituacaoCobrancaTag, situacaoDaCobranca } from './situacao-cobranca';

/** Visão da lista: o que vence no mês/semestre escolhido, ou todas as pendentes (qualquer período). */
type Visao = 'mes' | 'semestre' | 'aberto';

const ROTULO_VISAO: Record<Visao, string> = { mes: 'Por mês', semestre: 'Por semestre', aberto: 'Em aberto' };

interface CobrancaVisao {
  cobranca: ComId<Cobranca>;
  situacao: SituacaoCobranca;
  vencimento: Date;
  rotulo: string;
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
  private readonly mensagens = inject(MessageService);
  private readonly confirmacao = inject(ConfirmationService);
  private readonly router = inject(Router);

  // Período e visão ficam na URL (?periodo=AAAA-MM | AAAA-S1 & visao=aberto): voltar do celular e links funcionam.
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
    const visoes: Visao[] = [...this.visoesPeriodo(), 'aberto'];
    return visoes.map((value) => ({ value, label: ROTULO_VISAO[value] }));
  });

  protected readonly visaoAtual = computed<Visao>(() => {
    if (this.visao() === 'aberto') return 'aberto';
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
  /** Chave única do que está na tela: 'aberto' ou o período. */
  private readonly filtro = computed(() => (this.visaoAtual() === 'aberto' ? 'aberto' : this.periodoAtual()));
  protected readonly busca = signal('');

  private readonly cobrancas = signal<ComId<Cobranca>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly processando = signal(false);

  protected readonly lista = computed<CobrancaVisao[]>(() => {
    const hoje = new Date();
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    return this.cobrancas()
      .filter((c) => !termo || c.atletaNome.toLocaleLowerCase('pt-BR').includes(termo))
      .map((c) => ({
        cobranca: c,
        situacao: situacaoDaCobranca(c, hoje),
        vencimento: c.vencimento.toDate(),
        rotulo: `${nomeDaCobranca(c)} · ${competenciaDaCobranca(c)}`,
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
    for (const { cobranca, situacao } of this.lista()) {
      if (situacao === 'pago') recebido += cobranca.valorCentavos;
      if (situacao === 'pendente' || situacao === 'atrasado') aReceber += cobranca.valorCentavos;
      if (situacao === 'atrasado') atrasadas++;
    }
    return { aReceber, recebido, atrasadas };
  });

  // Diálogo de baixa.
  protected readonly emBaixa = signal<ComId<Cobranca> | null>(null);
  protected readonly dataPagamento = signal('');
  protected readonly observacao = signal('');
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
  }

  protected irParaPeriodo(periodo: string): void {
    this.atualizarUrl({ periodo, visao: null });
  }

  /** Ao trocar entre mês e semestre, abre o período de hoje do novo tipo. */
  protected trocarVisao(visao: Visao | null): void {
    if (visao === 'aberto') this.atualizarUrl({ visao: 'aberto' });
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

  protected fecharBaixa(visivel: boolean): void {
    if (!visivel) this.emBaixa.set(null);
  }

  protected async confirmarBaixa(): Promise<void> {
    const cobranca = this.emBaixa();
    const uid = this.auth.usuario()?.uid;
    if (!cobranca || !uid || !this.dataPagamento()) return;
    const observacao = this.observacao().trim().slice(0, 200);
    await this.executar(
      (timeId) => this.cobrancasService.darBaixa(timeId, cobranca, { pagoEm: deDataInput(this.dataPagamento()), observacao, uid }),
      'Pagamento registrado',
    );
    this.emBaixa.set(null);
  }

  protected estornar(cobranca: ComId<Cobranca>): void {
    this.confirmar(
      `Estornar o pagamento de ${cobranca.atletaNome}? A cobrança volta a pendente e a receita sai do caixa.`,
      'Estornar',
      () => this.executar((timeId) => this.cobrancasService.estornar(timeId, cobranca.id), 'Pagamento estornado'),
    );
  }

  protected cancelar(cobranca: ComId<Cobranca>): void {
    this.confirmar(
      `Cancelar a cobrança de ${cobranca.atletaNome}? Ela deixa de contar como pendente.`,
      'Cancelar cobrança',
      () => this.executar((timeId) => this.cobrancasService.definirCancelada(timeId, cobranca.id, true), 'Cobrança cancelada'),
    );
  }

  protected reabrir(cobranca: ComId<Cobranca>): Promise<void> {
    return this.executar(
      (timeId) => this.cobrancasService.definirCancelada(timeId, cobranca.id, false),
      'Cobrança reaberta',
    );
  }

  private confirmar(mensagem: string, rotulo: string, acao: () => Promise<void>): void {
    this.confirmacao.confirm({
      header: 'Confirmar',
      message: mensagem,
      acceptLabel: rotulo,
      rejectLabel: 'Voltar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { text: true },
      accept: () => void acao(),
    });
  }

  private async executar(acao: (timeId: string) => Promise<void>, sucesso: string): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.processando.set(true);
    try {
      await acao(timeId);
      this.mensagens.add({ severity: 'success', summary: sucesso });
      await this.carregar(timeId, this.filtro());
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível concluir', detail: mensagemDeErro(e) });
    } finally {
      this.processando.set(false);
    }
  }

  private async carregar(timeId: string, filtro: string): Promise<void> {
    this.carregando.set(true);
    try {
      const dados =
        filtro === 'aberto'
          ? await this.cobrancasService.listarEmAberto(timeId)
          : await this.listarDoPeriodo(timeId, filtro);
      // Descarta resposta atrasada (outro time ou outro filtro).
      if (this.timeAtual.timeId() === timeId && this.filtro() === filtro) this.cobrancas.set(dados);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar cobranças', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }

  private listarDoPeriodo(timeId: string, periodo: string) {
    const { inicio, fim } = intervaloDoPeriodo(periodo);
    return this.cobrancasService.listarPorVencimento(timeId, inicio, fim);
  }
}
