import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { AbaSecao, AbasSecao } from '../../shared/abas-secao';

/** Elenco | Artilharia. */
@Component({
  selector: 'app-elenco-abas',
  imports: [AbasSecao],
  template: `<app-abas-secao rotulo="Elenco" [abas]="abas()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElencoAbas {
  private readonly timeAtual = inject(TimeAtualService);

  protected readonly abas = computed<AbaSecao[]>(() => {
    const base = ['/t', this.timeAtual.timeId(), 'elenco'];
    return [
      { rotulo: 'Elenco', link: base, exata: true },
      { rotulo: 'Artilharia', link: [...base, 'artilharia'] },
    ];
  });
}
