import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { SessaoService } from '../../core/sessao/sessao.service';
import { Escudo } from '../../shared/escudo';
import { ROTULO_PAPEL } from '../../shared/rotulos';
import { ComId } from '../../core/firebase/conversor';
import { Evento } from '../../models/evento.model';
import { EventosService } from '../agenda/data/eventos.service';
import { CobrancasService } from '../financeiro/data/cobrancas.service';

@Component({
  selector: 'app-inicio-page',
  imports: [DatePipe, RouterLink, ButtonModule, SkeletonModule, Escudo, ChevronRight],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  private readonly sessao = inject(SessaoService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly eventosService = inject(EventosService);

  protected readonly meusTimes = this.sessao.meusTimes;
  protected readonly carregando = this.sessao.carregandoTimes;
  protected readonly adminGeral = this.sessao.adminGeral;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  /** Cobranças pendentes do meu atleta, por time (só times em que estou no elenco). */
  protected readonly pendentes = signal<ReadonlyMap<string, number>>(new Map());
  /** Próximo evento agendado de cada time (uma consulta por time, limit 1). */
  protected readonly proximos = signal<ReadonlyMap<string, ComId<Evento>>>(new Map());

  constructor() {
    effect(() => {
      const times = this.sessao.meusTimes().filter((t) => t.atletaId !== null);
      untracked(() => void this.contarPendentes(times));
    });
    effect(() => {
      const ids = this.sessao.meusTimes().map((t) => t.timeId);
      untracked(() => void this.carregarProximos(ids));
    });
  }

  /** Falha em um time (ex.: índice ainda sendo criado) não impede os outros. */
  private async carregarProximos(timeIds: string[]): Promise<void> {
    const agora = new Date();
    const pares = await Promise.all(
      timeIds.map(async (timeId): Promise<[string, ComId<Evento> | null]> => {
        try {
          return [timeId, await this.eventosService.proximoAgendado(timeId, agora)];
        } catch {
          return [timeId, null];
        }
      }),
    );
    const mapa = new Map<string, ComId<Evento>>();
    for (const [timeId, evento] of pares) if (evento) mapa.set(timeId, evento);
    this.proximos.set(mapa);
  }

  /** Uma contagem no servidor por time; falha em um time não impede os outros. */
  private async contarPendentes(times: { timeId: string; atletaId: string | null }[]): Promise<void> {
    const contagens = await Promise.all(
      times.map(async ({ timeId, atletaId }): Promise<[string, number]> => {
        if (!atletaId) return [timeId, 0];
        try {
          return [timeId, await this.cobrancasService.contarPendentesDoAtleta(timeId, atletaId)];
        } catch {
          return [timeId, 0];
        }
      }),
    );
    this.pendentes.set(new Map(contagens));
  }
}
