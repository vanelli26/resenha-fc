import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Patrocinador } from '../../models/patrocinador.model';
import { PatrocinadoresService } from './data/patrocinadores.service';
import { LogoPatrocinador } from './logo-patrocinador';

/** Faixa de apoiadores no topo do mural: logos em fila, rolagem lateral; tocar abre o link. */
@Component({
  selector: 'app-faixa-patrocinadores',
  imports: [LogoPatrocinador],
  template: `
    @if (lista().length > 0) {
      <section class="faixa" aria-label="Apoiadores">
        <span class="faixa__titulo">Apoiadores</span>
        <ul class="faixa__lista">
          @for (p of lista(); track p.id) {
            <li>
              @if (p.link) {
                <a class="apoiador" [href]="p.link" target="_blank" rel="noopener noreferrer" [title]="p.nome">
                  <app-logo-patrocinador [src]="p.logo" [nome]="p.nome" />
                  <span class="apoiador__nome">{{ p.nome }}</span>
                </a>
              } @else {
                <span class="apoiador" [title]="p.nome">
                  <app-logo-patrocinador [src]="p.logo" [nome]="p.nome" />
                  <span class="apoiador__nome">{{ p.nome }}</span>
                </span>
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    .faixa {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .faixa__titulo {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }

    // Rolagem lateral com encaixe; sem barra visível no celular.
    .faixa__lista {
      display: flex;
      gap: 0.75rem;
      margin: 0;
      padding: 0 0 0.25rem;
      list-style: none;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      scrollbar-width: thin;

      li {
        scroll-snap-align: start;
      }
    }

    .apoiador {
      display: grid;
      justify-items: center;
      gap: 0.25rem;
      width: 4.5rem;
      color: inherit;
      text-decoration: none;
      --logo-tamanho: 4rem;

      &:focus-visible {
        outline: 2px solid var(--p-primary-color);
        outline-offset: 2px;
        border-radius: var(--p-border-radius-lg);
      }
    }

    .apoiador__nome {
      max-width: 100%;
      overflow: hidden;
      font-size: 0.75rem;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--p-text-muted-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaixaPatrocinadores {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(PatrocinadoresService);

  protected readonly lista = signal<ComId<Patrocinador>[]>([]);

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.lista.set([]);
        if (timeId) {
          this.service
            .listar(timeId)
            .then((lista) => {
              if (this.timeAtual.timeId() === timeId) this.lista.set(lista);
            })
            // Faixa é complemento: falha não atrapalha o mural.
            .catch(() => undefined);
        }
      });
    });
  }
}
