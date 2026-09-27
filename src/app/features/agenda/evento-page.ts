import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { Evento, Presenca, RespostaPresenca } from '../../models/evento.model';
import { mensagemDeErro } from '../../shared/erros';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { ROTULO_ESPORTE, ROTULO_STATUS_EVENTO, ROTULO_TIPO_EVENTO } from '../../shared/rotulos';
import { Voltar } from '../../shared/voltar';
import { AtletasService } from '../elenco/data/atletas.service';
import { DadosEvento, EventosService, participa, podeResponder } from './data/eventos.service';
import { CobrancaAvulsos } from '../financeiro/cobranca-avulsos';
import { EncerrarEvento, Encerramento, Participante } from './encerrar-evento';
import { EventoForm } from './evento-form';
import { SeletorPresenca } from './seletor-presenca';

interface GrupoPresenca {
  chave: RespostaPresenca | 'sem' | 'compareceu' | 'faltou';
  titulo: string;
  pessoas: ComId<Atleta>[];
}

function ordenarPorNome(lista: ComId<Atleta>[]): ComId<Atleta>[] {
  return [...lista].sort((a, b) => (a.apelido || a.nome).localeCompare(b.apelido || b.nome, 'pt-BR'));
}

@Component({
  selector: 'app-evento-page',
  imports: [
    DatePipe,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    SkeletonModule,
    TagModule,
    CobrancaAvulsos,
    EncerrarEvento,
    EventoForm,
    FotoPessoa,
    SeletorPresenca,
    Voltar,
  ],
  providers: [ConfirmationService],
  templateUrl: './evento-page.html',
  styleUrl: './evento-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventoPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly eventosService = inject(EventosService);
  private readonly atletasService = inject(AtletasService);
  private readonly mensagens = inject(MessageService);
  private readonly confirmacao = inject(ConfirmationService);

  /** Parâmetro da rota (withComponentInputBinding). */
  readonly eventoId = input.required<string>();

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly ehTesouraria = this.timeAtual.ehTesouraria;
  protected readonly esportes = this.timeAtual.esportes;
  protected readonly rotuloTipo = ROTULO_TIPO_EVENTO;
  protected readonly rotuloStatus = ROTULO_STATUS_EVENTO;

  protected readonly evento = signal<ComId<Evento> | null>(null);
  protected readonly naoEncontrado = signal(false);
  private readonly cadastros = signal<ComId<Atleta>[]>([]);
  private readonly presencas = signal<ComId<Presenca>[]>([]);
  protected readonly respondendo = signal(false);
  protected readonly processando = signal(false);
  protected readonly dialogAberto = signal(false);
  protected readonly encerrandoAberto = signal(false);

  protected readonly esporte = computed(() => {
    const e = this.evento();
    return e && this.esportes().length > 1 ? ROTULO_ESPORTE[e.esporte] : null;
  });

  private readonly meuAtleta = computed(() => {
    const id = this.timeAtual.acesso()?.atletaId;
    return this.cadastros().find((a) => a.id === id) ?? null;
  });
  protected readonly podeResponder = computed(() => {
    const e = this.evento();
    const eu = this.meuAtleta();
    return !!e && !!eu && podeResponder(e, eu);
  });
  protected readonly minhaResposta = computed(() => {
    const id = this.meuAtleta()?.id;
    return this.presencas().find((p) => p.id === id)?.resposta ?? null;
  });

  /** Lista do encerramento: quem participa do tipo ou tem presença; quem disse "Vou" já vem marcado. */
  protected readonly participantes = computed<Participante[]>(() => {
    const e = this.evento();
    if (!e) return [];
    const presencas = new Map(this.presencas().map((p) => [p.id, p]));
    return ordenarPorNome(
      this.cadastros().filter((a) => participa(e.tipo, a) || presencas.has(a.id)),
    ).map((atleta) => {
      const p = presencas.get(atleta.id);
      return {
        atleta,
        resposta: p?.resposta ?? null,
        compareceu: p?.compareceu ?? p?.resposta === 'vou',
        temPresenca: !!p,
      };
    });
  });

  /** Quem compareceu (após o encerramento). */
  protected readonly compareceram = computed(() => {
    const presentes = new Set(this.presencas().filter((p) => p.compareceu).map((p) => p.id));
    return this.cadastros().filter((a) => presentes.has(a.id));
  });

  /**
   * Agendado: Vão · Talvez · Não vão · Sem resposta (quem participa e ainda não respondeu).
   * Realizado: Compareceram · Faltaram (disseram "Vou" ou "Talvez" e não foram).
   */
  protected readonly grupos = computed<GrupoPresenca[]>(() => {
    const e = this.evento();
    if (!e) return [];
    if (e.status === 'realizado') {
      const faltaram = this.presencas()
        .filter((p) => !p.compareceu && (p.resposta === 'vou' || p.resposta === 'talvez'))
        .map((p) => p.id);
      const idsFaltaram = new Set(faltaram);
      return [
        { chave: 'compareceu', titulo: 'Compareceram', pessoas: ordenarPorNome(this.compareceram()) },
        { chave: 'faltou', titulo: 'Faltaram', pessoas: ordenarPorNome(this.cadastros().filter((a) => idsFaltaram.has(a.id))) },
      ];
    }
    const porId = new Map(this.cadastros().map((a) => [a.id, a]));
    const respostas = new Map<string, RespostaPresenca>();
    for (const p of this.presencas()) if (p.resposta) respostas.set(p.id, p.resposta);
    const doGrupo = (r: RespostaPresenca) =>
      [...respostas].flatMap(([id, resp]) => {
        const pessoa = porId.get(id);
        return resp === r && pessoa ? [pessoa] : [];
      });
    const semResposta = this.cadastros().filter((a) => participa(e.tipo, a) && !respostas.has(a.id));
    return [
      { chave: 'vou', titulo: 'Vão', pessoas: ordenarPorNome(doGrupo('vou')) },
      { chave: 'talvez', titulo: 'Talvez', pessoas: ordenarPorNome(doGrupo('talvez')) },
      { chave: 'nao_vou', titulo: 'Não vão', pessoas: ordenarPorNome(doGrupo('nao_vou')) },
      { chave: 'sem', titulo: 'Sem resposta', pessoas: ordenarPorNome(semResposta) },
    ];
  });

  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const eventoId = this.eventoId();
      untracked(() => {
        this.pararDeOuvir?.();
        this.evento.set(null);
        this.presencas.set([]);
        this.naoEncontrado.set(false);
        if (timeId) void this.carregar(timeId, eventoId);
      });
    });
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
  }

  protected async responder(resposta: RespostaPresenca): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    const eu = this.meuAtleta();
    if (!timeId || !e || !eu) return;
    this.respondendo.set(true);
    try {
      // O listener atualiza as listas.
      await this.eventosService.responder(timeId, e.id, eu.id, resposta);
    } catch (err) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível responder', detail: mensagemDeErro(err) });
    } finally {
      this.respondendo.set(false);
    }
  }

  protected async salvarEdicao(dados: DadosEvento[]): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    const [editado] = dados;
    if (!timeId || !e || !editado) return;
    const ok = await this.executar(() => this.eventosService.atualizar(timeId, e.id, editado), 'Evento atualizado');
    if (ok) this.dialogAberto.set(false);
  }

  protected async encerrar(encerramento: Encerramento): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    if (!timeId || !e) return;
    const jaRealizado = e.status === 'realizado';
    const ok = await this.executar(
      () => this.eventosService.encerrar(timeId, e.id, encerramento.placar, encerramento.lista),
      jaRealizado ? 'Encerramento atualizado' : 'Evento encerrado',
    );
    if (ok) this.encerrandoAberto.set(false);
  }

  protected alternarCancelamento(): void {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    if (!timeId || !e) return;
    const cancelar = e.status === 'agendado';
    this.confirmacao.confirm({
      header: cancelar ? 'Cancelar evento' : 'Reativar evento',
      message: cancelar
        ? `Cancelar "${e.titulo}"? Ele continua na agenda, marcado como cancelado, e ninguém mais responde.`
        : `Reativar "${e.titulo}"? As respostas já dadas continuam valendo.`,
      acceptLabel: cancelar ? 'Cancelar evento' : 'Reativar',
      rejectLabel: 'Voltar',
      acceptButtonProps: { severity: cancelar ? 'danger' : 'primary' },
      rejectButtonProps: { text: true },
      accept: () =>
        void this.executar(
          () => this.eventosService.definirCancelado(timeId, e.id, cancelar),
          cancelar ? 'Evento cancelado' : 'Evento reativado',
        ),
    });
  }

  private async executar(acao: () => Promise<void>, sucesso: string): Promise<boolean> {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    if (!timeId || !e) return false;
    this.processando.set(true);
    try {
      await acao();
      this.mensagens.add({ severity: 'success', summary: sucesso });
      this.evento.set(await this.eventosService.obter(timeId, e.id));
      return true;
    } catch (err) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível concluir', detail: mensagemDeErro(err) });
      return false;
    } finally {
      this.processando.set(false);
    }
  }

  private async carregar(timeId: string, eventoId: string): Promise<void> {
    try {
      const [evento, cadastros] = await Promise.all([
        this.eventosService.obter(timeId, eventoId),
        this.atletasService.listar(timeId),
      ]);
      if (this.timeAtual.timeId() !== timeId || this.eventoId() !== eventoId) return;
      if (!evento) {
        this.naoEncontrado.set(true);
        return;
      }
      this.evento.set(evento);
      this.cadastros.set(cadastros);
      this.pararDeOuvir = this.eventosService.ouvirPresencas(
        timeId,
        eventoId,
        (presencas) => this.presencas.set(presencas),
        (err) =>
          this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar presenças', detail: mensagemDeErro(err) }),
      );
    } catch (err) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar o evento', detail: mensagemDeErro(err) });
    }
  }
}
