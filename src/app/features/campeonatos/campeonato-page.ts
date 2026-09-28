import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { Campeonato } from '../../models/campeonato.model';
import { NumerosAtleta, escopoCampeonato } from '../../models/estatistica.model';
import { Evento } from '../../models/evento.model';
import { Avisos } from '../../shared/avisos';
import { ROTULO_STATUS_CAMPEONATO } from '../../shared/rotulos';
import { Voltar } from '../../shared/voltar';
import { EventosService } from '../agenda/data/eventos.service';
import { CartaoEvento } from '../agenda/cartao-evento';
import { AtletasService } from '../elenco/data/atletas.service';
import { TotaisAtleta } from '../estatisticas/ajuste-artilharia';
import { EstatisticasService } from '../estatisticas/data/estatisticas.service';
import { RankingArtilharia } from '../estatisticas/ranking-artilharia';
import { campanhaDe } from './campanha';
import { CampeonatoForm } from './campeonato-form';
import { CampeonatosService, DadosCampeonato } from './data/campeonatos.service';

/** Campeonato: campanha (V/E/D), jogos e artilharia própria (automático + ajuste com escopo do campeonato). */
@Component({
  selector: 'app-campeonato-page',
  imports: [
    ButtonModule,
    DialogModule,
    SkeletonModule,
    TagModule,
    CampeonatoForm,
    CartaoEvento,
    RankingArtilharia,
    Voltar,
  ],
  templateUrl: './campeonato-page.html',
  styleUrl: './campeonato-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampeonatoPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly campeonatos = inject(CampeonatosService);
  private readonly eventosService = inject(EventosService);
  private readonly atletasService = inject(AtletasService);
  private readonly estatisticas = inject(EstatisticasService);
  private readonly avisos = inject(Avisos);

  readonly campeonatoId = input.required<string>();

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly rotuloStatus = ROTULO_STATUS_CAMPEONATO;
  protected readonly campeonato = signal<ComId<Campeonato> | null>(null);
  protected readonly naoEncontrado = signal(false);
  protected readonly jogos = signal<ComId<Evento>[]>([]);
  protected readonly cadastros = signal<ComId<Atleta>[]>([]);
  protected readonly automatico = signal<ReadonlyMap<string, NumerosAtleta>>(new Map());
  protected readonly ajustes = signal<ReadonlyMap<string, NumerosAtleta>>(new Map());
  protected readonly salvando = signal(false);
  protected readonly editando = signal(false);
  protected readonly editandoArtilharia = signal(false);

  protected readonly campanha = computed(() => campanhaDe(this.jogos()));
  /** Próximos primeiro (mais perto no topo), depois os já jogados, mais recentes primeiro. */
  protected readonly jogosOrdenados = computed(() => {
    const agendados = this.jogos().filter((e) => e.status === 'agendado');
    const demais = this.jogos()
      .filter((e) => e.status !== 'agendado')
      .reverse();
    return [...agendados, ...demais];
  });

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const campeonatoId = this.campeonatoId();
      untracked(() => {
        this.campeonato.set(null);
        this.naoEncontrado.set(false);
        this.jogos.set([]);
        this.automatico.set(new Map());
        this.ajustes.set(new Map());
        this.editando.set(false);
        this.editandoArtilharia.set(false);
        if (timeId) void this.carregar(timeId, campeonatoId);
      });
    });
  }

  protected async salvar(dados: DadosCampeonato): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const c = this.campeonato();
    if (!timeId || !c) return;
    const ok = await this.avisos.executar(
      this.salvando,
      () => this.campeonatos.atualizar(timeId, c.id, dados),
      'Campeonato atualizado',
      'Não foi possível salvar',
    );
    if (!ok) return;
    this.editando.set(false);
    this.campeonato.set({ ...c, ...dados });
  }

  protected async salvarAjuste(totais: TotaisAtleta): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.auth.usuario()?.uid;
    const campeonatoId = this.campeonatoId();
    if (!timeId || !uid) return;
    const escopo = escopoCampeonato(campeonatoId);
    const { atletaId, ...numeros } = totais;
    const ok = await this.avisos.executar(
      this.salvando,
      () => this.estatisticas.salvarTotais(timeId, escopo, atletaId, numeros, this.automatico().get(atletaId), uid),
      'Números atualizados',
      'Não foi possível salvar',
    );
    if (!ok) return;
    this.editandoArtilharia.set(false);
    const ajustes = await this.estatisticas.ajustesPorAtleta(timeId, escopo);
    if (this.ehAtual(timeId, campeonatoId)) this.ajustes.set(ajustes);
  }

  private async carregar(timeId: string, campeonatoId: string): Promise<void> {
    try {
      const [campeonato, jogos, cadastros, ajustes] = await Promise.all([
        this.campeonatos.obter(timeId, campeonatoId),
        this.eventosService.listarDoCampeonato(timeId, campeonatoId),
        this.atletasService.listar(timeId),
        this.estatisticas.ajustesPorAtleta(timeId, escopoCampeonato(campeonatoId)),
      ]);
      if (!this.ehAtual(timeId, campeonatoId)) return;
      if (!campeonato) {
        this.naoEncontrado.set(true);
        return;
      }
      this.campeonato.set(campeonato);
      this.jogos.set(jogos);
      this.cadastros.set(cadastros);
      this.ajustes.set(ajustes);
      const automatico = await this.estatisticas.automaticoDosEventos(timeId, jogos);
      if (this.ehAtual(timeId, campeonatoId)) this.automatico.set(automatico.porAtleta);
    } catch (e) {
      this.avisos.erro('Erro ao carregar o campeonato', e);
    }
  }

  /** Descarta resposta atrasada (outro time ou outro campeonato). */
  private ehAtual(timeId: string, campeonatoId: string): boolean {
    return this.timeAtual.timeId() === timeId && this.campeonatoId() === campeonatoId;
  }
}
