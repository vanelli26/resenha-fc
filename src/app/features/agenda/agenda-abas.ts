import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { AbaSecao, AbasSecao } from '../../shared/abas-secao';

/** Agenda | Campeonatos. */
@Component({
  selector: 'app-agenda-abas',
  imports: [AbasSecao],
  template: `<app-abas-secao rotulo="Agenda" [abas]="abas()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaAbas {
  private readonly timeAtual = inject(TimeAtualService);

  protected readonly abas = computed<AbaSecao[]>(() => {
    const base = ['/t', this.timeAtual.timeId(), 'agenda'];
    return [
      { rotulo: 'Agenda', link: base, exata: true },
      { rotulo: 'Campeonatos', link: [...base, 'campeonatos'] },
    ];
  });
}
