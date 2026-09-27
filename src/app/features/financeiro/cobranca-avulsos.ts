import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { Evento } from '../../models/evento.model';
import { PlanoCobranca } from '../../models/time.model';
import { ReaisPipe } from '../../shared/dinheiro';
import { mensagemDeErro } from '../../shared/erros';
import { CobrancasService, NovaCobranca } from './data/cobrancas.service';

interface Avulso {
  atleta: ComId<Atleta>;
  plano: PlanoCobranca;
  jaGerada: boolean;
}

/**
 * Cobrança dos avulsos de um evento realizado (tesouraria, DIRETRIZES 5): quem compareceu e tem plano
 * avulso, com o valor do próprio plano; vence na data do jogo. Referência = eventoId (não duplica).
 */
@Component({
  selector: 'app-cobranca-avulsos',
  imports: [ButtonModule, ReaisPipe],
  templateUrl: './cobranca-avulsos.html',
  styleUrl: './cobranca-avulsos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CobrancaAvulsos {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly mensagens = inject(MessageService);

  readonly evento = input.required<ComId<Evento>>();
  /** Quem compareceu (marcado no encerramento). */
  readonly compareceram = input.required<ComId<Atleta>[]>();

  private readonly geradas = signal<ReadonlySet<string> | null>(null);
  protected readonly gerando = signal(false);

  protected readonly avulsos = computed<Avulso[]>(() => {
    const planos = new Map(this.timeAtual.planos().map((p) => [p.id, p]));
    const geradas = this.geradas() ?? new Set<string>();
    const lista: Avulso[] = [];
    for (const atleta of this.compareceram()) {
      const plano = planos.get(atleta.modalidade);
      if (plano?.periodicidade === 'avulso') lista.push({ atleta, plano, jaGerada: geradas.has(atleta.id) });
    }
    return lista;
  });
  protected readonly pendentes = computed(() => this.avulsos().filter((a) => !a.jaGerada));
  protected readonly total = computed(() => this.pendentes().reduce((soma, a) => soma + a.plano.valorCentavos, 0));
  protected readonly carregando = computed(() => this.geradas() === null);

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const eventoId = this.evento().id;
      untracked(() => {
        this.geradas.set(null);
        if (timeId) void this.carregarGeradas(timeId, eventoId);
      });
    });
  }

  protected async gerar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const evento = this.evento();
    if (!timeId || this.pendentes().length === 0) return;
    const novas: NovaCobranca[] = this.pendentes().map((a) => ({
      atletaId: a.atleta.id,
      atletaNome: a.atleta.nome,
      tipo: 'avulso',
      referencia: evento.id,
      valorCentavos: a.plano.valorCentavos,
      vencimento: evento.data.toDate(),
      planoNome: a.plano.nome,
    }));
    this.gerando.set(true);
    try {
      await this.cobrancasService.gerar(timeId, novas);
      this.mensagens.add({ severity: 'success', summary: `${novas.length} cobrança(s) gerada(s)` });
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível gerar', detail: mensagemDeErro(e) });
    } finally {
      this.gerando.set(false);
      await this.carregarGeradas(timeId, evento.id);
    }
  }

  private async carregarGeradas(timeId: string, eventoId: string): Promise<void> {
    try {
      const cobrancas = await this.cobrancasService.listarPorReferencia(timeId, eventoId);
      if (this.timeAtual.timeId() === timeId && this.evento().id === eventoId) {
        this.geradas.set(new Set(cobrancas.map((c) => c.atletaId)));
      }
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar cobranças', detail: mensagemDeErro(e) });
    }
  }
}
