import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Cobranca } from '../../models/financeiro.model';
import { rotuloReferencia } from '../../shared/competencia';
import { ReaisPipe } from '../../shared/dinheiro';
import { mensagemDeErro } from '../../shared/erros';
import { ROTULO_TIPO_COBRANCA } from '../../shared/rotulos';
import { CobrancasService } from './data/cobrancas.service';
import { FinanceiroAbas } from './financeiro-abas';
import { SituacaoCobranca, SituacaoCobrancaTag, situacaoDaCobranca } from './situacao-cobranca';

interface MinhaCobranca {
  cobranca: ComId<Cobranca>;
  situacao: SituacaoCobranca;
  rotulo: string;
}

/**
 * Cobranças do próprio atleta (qualquer modalidade, DIRETRIZES 11.4). Nunca mostra o caixa.
 * Consulta filtrada por atletaId, como as Rules exigem para o jogador.
 */
@Component({
  selector: 'app-minhas-cobrancas-page',
  imports: [DatePipe, SkeletonModule, ReaisPipe, FinanceiroAbas, SituacaoCobrancaTag],
  templateUrl: './minhas-cobrancas-page.html',
  styleUrl: './minhas-cobrancas-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinhasCobrancasPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly mensagens = inject(MessageService);

  protected readonly ehGestao = this.timeAtual.ehGestao;
  protected readonly atletaId = computed(() => this.timeAtual.acesso()?.atletaId ?? null);

  private readonly cobrancas = signal<ComId<Cobranca>[]>([]);
  protected readonly carregando = signal(true);

  protected readonly lista = computed<MinhaCobranca[]>(() => {
    const hoje = new Date();
    return this.cobrancas().map((c) => ({
      cobranca: c,
      situacao: situacaoDaCobranca(c, hoje),
      rotulo: `${ROTULO_TIPO_COBRANCA[c.tipo]} · ${rotuloReferencia(c.referencia)}`,
    }));
  });
  /** Em aberto primeiro (atrasadas no topo); o resto segue do mais recente ao mais antigo. */
  protected readonly emAberto = computed(() =>
    this.lista()
      .filter((c) => c.situacao === 'pendente' || c.situacao === 'atrasado')
      .sort((a, b) => a.cobranca.vencimento.toMillis() - b.cobranca.vencimento.toMillis()),
  );
  protected readonly historico = computed(() =>
    this.lista().filter((c) => c.situacao === 'pago' || c.situacao === 'cancelado'),
  );
  protected readonly totalEmAberto = computed(() =>
    this.emAberto().reduce((total, c) => total + c.cobranca.valorCentavos, 0),
  );

  constructor() {
    // Recarrega ao trocar de time (tela reaproveitada).
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const atletaId = this.atletaId();
      untracked(() => {
        this.cobrancas.set([]);
        if (timeId && atletaId) void this.carregar(timeId, atletaId);
        else this.carregando.set(false);
      });
    });
  }

  private async carregar(timeId: string, atletaId: string): Promise<void> {
    this.carregando.set(true);
    try {
      const dados = await this.cobrancasService.listarDoAtleta(timeId, atletaId);
      if (this.timeAtual.timeId() === timeId) this.cobrancas.set(dados);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar suas cobranças', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }
}
