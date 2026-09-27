import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { SessaoService } from '../../core/sessao/sessao.service';
import { Escudo } from '../../shared/escudo';
import { ROTULO_PAPEL } from '../../shared/rotulos';
import { CobrancasService } from '../financeiro/data/cobrancas.service';

@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink, ButtonModule, SkeletonModule, Escudo, ChevronRight],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  private readonly sessao = inject(SessaoService);
  private readonly cobrancasService = inject(CobrancasService);

  protected readonly meusTimes = this.sessao.meusTimes;
  protected readonly carregando = this.sessao.carregandoTimes;
  protected readonly adminGeral = this.sessao.adminGeral;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  /** Cobranças pendentes do meu atleta, por time (só times em que estou no elenco). */
  protected readonly pendentes = signal<ReadonlyMap<string, number>>(new Map());

  constructor() {
    effect(() => {
      const times = this.sessao.meusTimes().filter((t) => t.atletaId !== null);
      untracked(() => void this.contarPendentes(times));
    });
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
