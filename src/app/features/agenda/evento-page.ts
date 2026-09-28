import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { EllipsisV } from '@primeicons/angular/ellipsis-v';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { MenuModule } from 'primeng/menu';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { Campeonato } from '../../models/campeonato.model';
import { Evento, Gol, Presenca, RespostaPresenca, TIPOS_EVENTO_ABERTOS } from '../../models/evento.model';
import { Avisos, confirmacaoPadrao } from '../../shared/avisos';
import { ROTULO_ESPORTE, ROTULO_STATUS_EVENTO, ROTULO_TIPO_EVENTO } from '../../shared/rotulos';
import { Voltar } from '../../shared/voltar';
import { CampeonatosService } from '../campeonatos/data/campeonatos.service';
import { AtletasService } from '../elenco/data/atletas.service';
import { DadosEvento, EventosService, participa, podeResponder } from './data/eventos.service';
import { CobrancaAvulsos } from '../financeiro/cobranca-avulsos';
import { AjustePresenca } from './ajuste-presenca';
import { ChamarTime } from './chamar-time';
import { EncerrarEvento, Encerramento, Participante } from './encerrar-evento';
import { EventoForm, OpcaoCampeonato, opcoesDeCampeonato } from './evento-form';
import { ListaPresenca, gruposDePresenca, ordenarPorNome } from './lista-presenca';
import { SeletorPresenca } from './seletor-presenca';

@Component({
  selector: 'app-evento-page',
  imports: [
    DatePipe,
    RouterLink,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    MenuModule,
    SkeletonModule,
    TagModule,
    ChevronRight,
    EllipsisV,
    AjustePresenca,
    ChamarTime,
    CobrancaAvulsos,
    EncerrarEvento,
    EventoForm,
    ListaPresenca,
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
  private readonly campeonatosService = inject(CampeonatosService);
  private readonly avisos = inject(Avisos);
  private readonly confirmacao = inject(ConfirmationService);

  /** Parâmetro da rota (withComponentInputBinding). */
  readonly eventoId = input.required<string>();

  protected readonly timeId = this.timeAtual.timeId;
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
  /** Campeonato do evento (nome e link) e opções do formulário de edição (diretoria). */
  protected readonly campeonato = signal<ComId<Campeonato> | null>(null);
  protected readonly opcoesCampeonato = signal<OpcaoCampeonato[]>([]);
  protected readonly linkCampeonato = computed(() => [
    '/t',
    this.timeAtual.timeId(),
    'agenda',
    'campeonatos',
    this.campeonato()?.id,
  ]);
  protected readonly encerrandoAberto = signal(false);
  protected readonly gols = signal<ComId<Gol>[]>([]);

  /** Ajuste de presença do evento encerrado (diretoria), no lugar da lista. */
  protected readonly ajustando = signal(false);

  /** Gols para exibir: "Fulano (Beltrano)", "Gol contra". */
  protected readonly textoGols = computed(() => {
    const nomes = new Map(this.cadastros().map((a) => [a.id, a.apelido || a.nome]));
    return this.gols().map((g) => {
      if (!g.autorId) return 'Gol contra';
      const autor = nomes.get(g.autorId) ?? '?';
      const assist = g.assistenciaId ? nomes.get(g.assistenciaId) : undefined;
      return assist ? `${autor} (${assist})` : autor;
    });
  });

  /** Escalação só em eventos esportivos não cancelados (DIRETRIZES 2.9). */
  protected readonly temEscalacao = computed(() => {
    const e = this.evento();
    return !!e && e.status !== 'cancelado' && !TIPOS_EVENTO_ABERTOS.includes(e.tipo);
  });

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

  protected readonly grupos = computed(() => {
    const e = this.evento();
    return e ? gruposDePresenca(e, this.cadastros(), this.presencas()) : [];
  });

  protected readonly idsCompareceram = computed<ReadonlySet<string>>(
    () => new Set(this.compareceram().map((a) => a.id)),
  );

  /** Ações secundárias da diretoria (menu "⋯"); Encerrar fica como botão principal. */
  protected readonly menuAcoes = computed<MenuItem[]>(() => {
    const e = this.evento();
    if (!e) return [];
    if (e.status === 'realizado') {
      return [{ label: 'Editar encerramento', command: () => this.encerrandoAberto.set(true) }];
    }
    return [
      { label: 'Editar evento', command: () => void this.abrirEdicao() },
      {
        label: e.status === 'agendado' ? 'Cancelar evento' : 'Reativar evento',
        command: () => this.alternarCancelamento(),
      },
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
        this.gols.set([]);
        this.campeonato.set(null);
        this.ajustando.set(false);
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
      this.avisos.erro('Não foi possível responder', err);
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
      () =>
        this.eventosService.encerrar(timeId, e.id, {
          placar: encerramento.placar,
          gols: encerramento.gols,
          golsAnteriores: this.gols().length,
          presenca: encerramento.presenca,
        }),
      jaRealizado ? 'Encerramento atualizado' : 'Evento encerrado',
    );
    if (ok) {
      this.encerrandoAberto.set(false);
      await this.carregarGols(timeId, e.id);
    }
  }

  protected async salvarAjuste(presentes: ReadonlySet<string>): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    if (!timeId || !e) return;
    const lista = this.participantes().map((p) => ({
      atletaId: p.atleta.id,
      compareceu: presentes.has(p.atleta.id),
      temPresenca: p.temPresenca,
    }));
    const ok = await this.executar(
      () => this.eventosService.salvarComparecimento(timeId, e.id, lista),
      'Presença atualizada',
    );
    if (ok) this.ajustando.set(false);
  }

  protected alternarCancelamento(): void {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    if (!timeId || !e) return;
    const cancelar = e.status === 'agendado';
    this.confirmacao.confirm(
      confirmacaoPadrao({
        titulo: cancelar ? 'Cancelar evento' : 'Reativar evento',
        mensagem: cancelar
          ? `Cancelar "${e.titulo}"? Ele continua na agenda, marcado como cancelado, e ninguém mais responde.`
          : `Reativar "${e.titulo}"? As respostas já dadas continuam valendo.`,
        rotulo: cancelar ? 'Cancelar evento' : 'Reativar',
        perigosa: cancelar,
        aoConfirmar: () =>
          void this.executar(
            () => this.eventosService.definirCancelado(timeId, e.id, cancelar),
            cancelar ? 'Evento cancelado' : 'Evento reativado',
          ),
      }),
    );
  }

  /** Escrita no evento: em caso de sucesso, relê o evento (status, placar). */
  private async executar(acao: () => Promise<void>, sucesso: string): Promise<boolean> {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    if (!timeId || !e) return false;
    const ok = await this.avisos.executar(this.processando, acao, sucesso);
    if (!ok) return false;
    const atualizado = await this.eventosService.obter(timeId, e.id);
    this.evento.set(atualizado);
    if (atualizado) void this.carregarCampeonato(timeId, atualizado);
    return true;
  }

  private async abrirEdicao(): Promise<void> {
    this.dialogAberto.set(true);
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    try {
      const lista = await this.campeonatosService.listar(timeId);
      if (this.timeAtual.timeId() === timeId) {
        this.opcoesCampeonato.set(opcoesDeCampeonato(lista, this.evento()?.campeonatoId));
      }
    } catch (err) {
      this.avisos.erro('Erro ao carregar campeonatos', err);
    }
  }

  private async carregarCampeonato(timeId: string, evento: ComId<Evento>): Promise<void> {
    const id = evento.campeonatoId;
    if (!id) {
      this.campeonato.set(null);
      return;
    }
    try {
      const c = await this.campeonatosService.obter(timeId, id);
      if (this.timeAtual.timeId() === timeId && this.evento()?.campeonatoId === id) this.campeonato.set(c);
    } catch {
      // Só o nome no cabeçalho: sem ele, o evento aparece normalmente.
    }
  }

  private async carregarGols(timeId: string, eventoId: string): Promise<void> {
    try {
      const gols = await this.eventosService.listarGols(timeId, eventoId);
      if (this.timeAtual.timeId() === timeId && this.eventoId() === eventoId) this.gols.set(gols);
    } catch (err) {
      this.avisos.erro('Erro ao carregar os gols', err);
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
      if (evento.status === 'realizado') void this.carregarGols(timeId, eventoId);
      void this.carregarCampeonato(timeId, evento);
      this.pararDeOuvir = this.eventosService.ouvirPresencas(
        timeId,
        eventoId,
        (presencas) => this.presencas.set(presencas),
        (err) => this.avisos.erro('Erro ao carregar presenças', err),
      );
    } catch (err) {
      this.avisos.erro('Erro ao carregar o evento', err);
    }
  }
}
