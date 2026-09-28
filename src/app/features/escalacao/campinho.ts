import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComId } from '../../core/firebase/conversor';
import { Atleta } from '../../models/atleta.model';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { Vaga } from './formacoes';

export interface VagaCampinho extends Vaga {
  atleta: ComId<Atleta> | null;
}

/** Campinho com as vagas da formação (ataque no topo). Com `editavel`, cada vaga é um botão que emite `tocar`. */
@Component({
  selector: 'app-campinho',
  imports: [FotoPessoa],
  template: `
    <div class="campo" role="group" aria-label="Campinho">
      <span class="campo__meio" aria-hidden="true"></span>
      <span class="campo__circulo" aria-hidden="true"></span>
      <span class="campo__area campo__area--topo" aria-hidden="true"></span>
      <span class="campo__area campo__area--base" aria-hidden="true"></span>

      @for (v of vagas(); track v.indice) {
        @let nome = v.atleta ? v.atleta.apelido || v.atleta.nome : v.rotulo;
        <button
          type="button"
          class="vaga"
          [class.vaga--vazia]="!v.atleta"
          [style.left.%]="v.x"
          [style.top.%]="v.y"
          [disabled]="!editavel()"
          [attr.aria-label]="v.rotulo + ': ' + (v.atleta ? nome : 'vaga livre')"
          (click)="tocar.emit(v.indice)"
        >
          @if (v.atleta) {
            <app-foto-pessoa [src]="v.atleta.fotoUrl" [nome]="nome" />
          } @else {
            <span class="vaga__livre" aria-hidden="true">+</span>
          }
          <span class="vaga__nome">{{ nome }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .campo {
      position: relative;
      width: 100%;
      max-width: 26rem;
      margin: 0 auto;
      aspect-ratio: 2 / 3;
      border: 2px solid color-mix(in srgb, var(--p-surface-0) 70%, transparent);
      border-radius: var(--p-border-radius-lg);
      background: repeating-linear-gradient(
        180deg,
        var(--p-green-700) 0 12.5%,
        var(--p-green-800) 12.5% 25%
      );
      overflow: hidden;
    }

    // Marcações do campo em branco translúcido.
    .campo__meio,
    .campo__circulo,
    .campo__area {
      position: absolute;
      border: 2px solid color-mix(in srgb, var(--p-surface-0) 45%, transparent);
      pointer-events: none;
    }
    .campo__meio {
      left: 0;
      right: 0;
      top: 50%;
      border-width: 2px 0 0;
    }
    .campo__circulo {
      left: 50%;
      top: 50%;
      width: 24%;
      aspect-ratio: 1;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }
    .campo__area {
      left: 25%;
      right: 25%;
      height: 12%;
    }
    .campo__area--topo {
      top: -2px;
    }
    .campo__area--base {
      bottom: -2px;
    }

    .vaga {
      --foto-tamanho: 2.5rem;
      position: absolute;
      display: grid;
      justify-items: center;
      gap: 0.125rem;
      width: 4.75rem;
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-surface-0);
      font: inherit;
      transform: translate(-50%, -50%);
      cursor: pointer;

      &:disabled {
        cursor: default;
      }

      &:focus-visible {
        outline: 2px solid var(--p-surface-0);
        outline-offset: 2px;
        border-radius: var(--p-border-radius-md);
      }
    }
    .vaga__livre {
      display: grid;
      place-items: center;
      width: var(--foto-tamanho);
      height: var(--foto-tamanho);
      border: 2px dashed color-mix(in srgb, var(--p-surface-0) 80%, transparent);
      border-radius: 50%;
      font-size: 1.25rem;
      font-weight: 700;
    }
    .vaga__nome {
      max-width: 100%;
      padding: 0 0.25rem;
      border-radius: var(--p-border-radius-sm);
      background: color-mix(in srgb, var(--p-surface-950) 55%, transparent);
      font-size: 0.75rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .vaga--vazia .vaga__nome {
      opacity: 0.8;
      font-weight: 400;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Campinho {
  readonly vagas = input.required<VagaCampinho[]>();
  readonly editavel = input(false);
  readonly tocar = output<number>();
}
