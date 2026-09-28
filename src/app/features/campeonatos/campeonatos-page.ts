import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Campeonato } from '../../models/campeonato.model';
import { Avisos } from '../../shared/avisos';
import { ROTULO_STATUS_CAMPEONATO } from '../../shared/rotulos';
import { AgendaAbas } from '../agenda/agenda-abas';
import { CampeonatoForm } from './campeonato-form';
import { CampeonatosService, DadosCampeonato } from './data/campeonatos.service';

/** Campeonatos do time (DIRETRIZES 2.10): todos veem; a diretoria cadastra. */
@Component({
  selector: 'app-campeonatos-page',
  imports: [RouterLink, ChevronRight, ButtonModule, DialogModule, SkeletonModule, TagModule, AgendaAbas, CampeonatoForm],
  template: `
    <app-agenda-abas />

    <div class="cabecalho-secao">
      <h2>Campeonatos</h2>
      @if (ehDiretoria()) {
        <p-button label="Novo campeonato" size="small" (onClick)="dialogAberto.set(true)" />
      }
    </div>

    @if (carregando() && campeonatos().length === 0) {
      <div class="lista">
        <p-skeleton height="4rem" />
        <p-skeleton height="4rem" />
      </div>
    } @else {
      <ul class="lista">
        @for (c of campeonatos(); track c.id) {
          <li>
            <a class="cartao-link" [routerLink]="c.id">
              <span class="campeonato__texto">
                <strong>{{ c.nome }}</strong>
                <small class="texto-suave">Temporada {{ c.temporada }}</small>
              </span>
              <p-tag [value]="rotuloStatus[c.status]" [severity]="c.status === 'andamento' ? 'success' : 'secondary'" />
              <svg class="cartao-link__seta" data-p-icon="chevron-right" [size]="18" aria-hidden="true"></svg>
            </a>
          </li>
        } @empty {
          <li class="texto-suave">
            Nenhum campeonato. {{ ehDiretoria() ? 'Cadastre um e escolha-o nos eventos do tipo Campeonato.' : '' }}
          </li>
        }
      </ul>
    }

    <p-dialog header="Novo campeonato" [(visible)]="dialogAberto" [modal]="true" [style]="{ width: 'min(28rem, 100vw - 2rem)' }">
      @if (dialogAberto()) {
        <app-campeonato-form [salvando]="salvando()" (salvar)="criar($event)" (cancelar)="dialogAberto.set(false)" />
      }
    </p-dialog>
  `,
  styles: `
    .campeonato__texto {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 0.125rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampeonatosPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(CampeonatosService);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly rotuloStatus = ROTULO_STATUS_CAMPEONATO;
  protected readonly campeonatos = signal<ComId<Campeonato>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly dialogAberto = signal(false);

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.campeonatos.set([]);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar(timeId);
      });
    });
  }

  protected async criar(dados: DadosCampeonato): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    let id = '';
    const ok = await this.avisos.executar(
      this.salvando,
      async () => (id = await this.service.criar(timeId, dados)),
      'Campeonato criado',
      'Não foi possível salvar',
    );
    if (!ok) return;
    this.dialogAberto.set(false);
    await this.router.navigate(['/t', timeId, 'agenda', 'campeonatos', id]);
  }

  private async carregar(timeId: string): Promise<void> {
    this.carregando.set(true);
    try {
      const lista = await this.service.listar(timeId);
      if (this.timeAtual.timeId() === timeId) this.campeonatos.set(lista);
    } catch (e) {
      this.avisos.erro('Erro ao carregar campeonatos', e);
    } finally {
      this.carregando.set(false);
    }
  }
}
