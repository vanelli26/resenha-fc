import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { Evento, RespostaPresenca } from '../../models/evento.model';
import { Avisos } from '../../shared/avisos';
import { ROTULO_ESPORTE } from '../../shared/rotulos';
import { AtletasService } from '../elenco/data/atletas.service';
import { DadosEvento, EventosService, TAMANHO_PAGINA_ANTERIORES, podeResponder } from './data/eventos.service';
import { EventoForm } from './evento-form';
import { CartaoEvento } from './cartao-evento';

/** Eventos de hoje seguem em "Próximos" o dia inteiro (quem chega atrasado ainda vê e responde). */
function inicioDeHoje(): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

interface ItemAgenda {
  evento: ComId<Evento>;
  /** Rótulo do esporte, só quando o time pratica mais de um. */
  esporte: string | null;
  podeResponder: boolean;
  resposta: RespostaPresenca | null;
}

@Component({
  selector: 'app-agenda-page',
  imports: [ButtonModule, DialogModule, SkeletonModule, CartaoEvento, EventoForm],
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly eventosService = inject(EventosService);
  private readonly atletasService = inject(AtletasService);
  private readonly avisos = inject(Avisos);

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly esportes = this.timeAtual.esportes;

  private readonly proximos = signal<ComId<Evento>[]>([]);
  private readonly anteriores = signal<ComId<Evento>[]>([]);
  private readonly meuAtleta = signal<ComId<Atleta> | null>(null);
  private readonly respostas = signal<ReadonlyMap<string, RespostaPresenca>>(new Map());
  protected readonly carregando = signal(true);
  protected readonly mostrandoAnteriores = signal(false);
  protected readonly carregandoAnteriores = signal(false);
  protected readonly haMaisAnteriores = signal(false);
  /** Evento com resposta sendo gravada (desabilita os botões dele). */
  protected readonly respondendo = signal<string | null>(null);

  protected readonly itensProximos = computed(() => this.paraItens(this.proximos()));
  protected readonly itensAnteriores = computed(() => this.paraItens(this.anteriores()));

  protected readonly dialogAberto = signal(false);
  protected readonly salvando = signal(false);

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const atletaId = this.timeAtual.acesso()?.atletaId ?? null;
      untracked(() => {
        this.proximos.set([]);
        this.anteriores.set([]);
        this.respostas.set(new Map());
        this.mostrandoAnteriores.set(false);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar(timeId, atletaId);
      });
    });
  }

  protected async responder(item: ItemAgenda, resposta: RespostaPresenca): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const atleta = this.meuAtleta();
    if (!timeId || !atleta) return;
    const anterior = this.respostas();
    this.respostas.set(new Map(anterior).set(item.evento.id, resposta));
    this.respondendo.set(item.evento.id);
    try {
      await this.eventosService.responder(timeId, item.evento.id, atleta.id, resposta);
    } catch (e) {
      this.respostas.set(anterior);
      this.avisos.erro('Não foi possível responder', e);
    } finally {
      this.respondendo.set(null);
    }
  }

  protected async verAnteriores(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.mostrandoAnteriores.set(true);
    this.carregandoAnteriores.set(true);
    try {
      const ultimo = this.anteriores().at(-1)?.data;
      const pagina = await this.eventosService.listarAnteriores(timeId, inicioDeHoje(), ultimo);
      if (this.timeAtual.timeId() !== timeId) return;
      this.anteriores.update((lista) => [...lista, ...pagina]);
      this.haMaisAnteriores.set(pagina.length === TAMANHO_PAGINA_ANTERIORES);
    } catch (e) {
      this.avisos.erro('Erro ao carregar a agenda', e);
    } finally {
      this.carregandoAnteriores.set(false);
    }
  }

  protected async criar(eventos: DadosEvento[]): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.auth.usuario()?.uid;
    if (!timeId || !uid) return;
    const ok = await this.avisos.executar(
      this.salvando,
      () => this.eventosService.criar(timeId, eventos, uid),
      eventos.length > 1 ? `${eventos.length} eventos criados` : 'Evento criado',
      'Não foi possível salvar',
    );
    if (!ok) return;
    this.dialogAberto.set(false);
    await this.carregar(timeId, this.timeAtual.acesso()?.atletaId ?? null);
  }

  private paraItens(eventos: ComId<Evento>[]): ItemAgenda[] {
    const atleta = this.meuAtleta();
    const respostas = this.respostas();
    const variosEsportes = this.esportes().length > 1;
    return eventos.map((evento) => ({
      evento,
      esporte: variosEsportes ? ROTULO_ESPORTE[evento.esporte] : null,
      podeResponder: atleta !== null && podeResponder(evento, atleta),
      resposta: respostas.get(evento.id) ?? null,
    }));
  }

  private async carregar(timeId: string, atletaId: string | null): Promise<void> {
    this.carregando.set(true);
    try {
      const [eventos, atleta] = await Promise.all([
        this.eventosService.listarProximos(timeId, inicioDeHoje()),
        atletaId ? this.atletasService.obter(timeId, atletaId) : Promise.resolve(null),
      ]);
      if (this.timeAtual.timeId() !== timeId) return;
      this.proximos.set(eventos);
      this.meuAtleta.set(atleta);
      if (atleta) {
        const abertos = eventos.filter((e) => podeResponder(e, atleta)).map((e) => e.id);
        const respostas = await this.eventosService.minhasRespostas(timeId, abertos, atleta.id);
        if (this.timeAtual.timeId() === timeId) this.respostas.set(respostas);
      }
    } catch (e) {
      this.avisos.erro('Erro ao carregar a agenda', e);
    } finally {
      this.carregando.set(false);
    }
  }
}
