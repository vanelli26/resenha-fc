import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Cobranca } from '../../models/financeiro.model';
import {
  deDataInput,
  paraDataInput,
  referenciasMensais,
  referenciasSemestrais,
  rotuloReferencia,
} from '../../shared/competencia';
import { ReaisPipe } from '../../shared/dinheiro';
import { mensagemDeErro } from '../../shared/erros';
import { ROTULO_TIPO_COBRANCA } from '../../shared/rotulos';
import { CobrancasService } from './data/cobrancas.service';
import { SituacaoCobranca, SituacaoCobrancaTag, situacaoDaCobranca } from './situacao-cobranca';

/** Filtro da lista: todas as pendentes ou uma competência (AAAA-MM / AAAA-S1). */
const EM_ABERTO = 'aberto';

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
    SelectModule,
    SkeletonModule,
    ReaisPipe,
    SituacaoCobrancaTag,
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

  /** `?ref=` vindo de "Gerar cobranças": abre direto na competência gerada. */
  readonly ref = input<string>();

  protected readonly ehTesouraria = this.timeAtual.ehTesouraria;
  protected readonly timeId = this.timeAtual.timeId;

  protected readonly opcoesFiltro = computed(() => {
    const hoje = new Date();
    const habilitadas = this.timeAtual.modalidadesHabilitadas();
    return [
      { label: 'Em aberto (todas)', value: EM_ABERTO },
      ...(habilitadas.includes('mensal')
        ? referenciasMensais(hoje).map((r) => ({ label: rotuloReferencia(r), value: r }))
        : []),
      ...(habilitadas.includes('semestral')
        ? referenciasSemestrais(hoje).map((r) => ({ label: rotuloReferencia(r), value: r }))
        : []),
    ];
  });
  protected readonly filtro = linkedSignal(() => this.ref() || EM_ABERTO);
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
        rotulo: `${ROTULO_TIPO_COBRANCA[c.tipo]} · ${rotuloReferencia(c.referencia)}`,
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
    // Recarrega ao trocar de time (tela reaproveitada) ou de filtro.
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
        filtro === EM_ABERTO
          ? await this.cobrancasService.listarEmAberto(timeId)
          : await this.cobrancasService.listarPorReferencia(timeId, filtro);
      // Descarta resposta atrasada (outro time ou outro filtro).
      if (this.timeAtual.timeId() === timeId && this.filtro() === filtro) this.cobrancas.set(dados);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar cobranças', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }
}
