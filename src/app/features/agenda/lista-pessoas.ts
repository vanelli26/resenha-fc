import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComId } from '../../core/firebase/conversor';
import { Atleta } from '../../models/atleta.model';
import { FotoPessoa } from '../../shared/foto-pessoa';

/** Grade compacta de pessoas (foto + nome). Com `tocavel`, cada pessoa é um botão que emite `tocar`. */
@Component({
  selector: 'app-lista-pessoas',
  imports: [FotoPessoa],
  template: `
    <ul class="pessoas" [class.pessoas--apagadas]="apagadas()">
      @for (pessoa of pessoas(); track pessoa.id) {
        @let nome = pessoa.apelido || pessoa.nome;
        <li>
          @if (tocavel()) {
            <button type="button" class="pessoa pessoa--botao" (click)="tocar.emit(pessoa.id)">
              <app-foto-pessoa [src]="pessoa.fotoUrl" [nome]="nome" />
              <span>{{ nome }}</span>
            </button>
          } @else {
            <span class="pessoa">
              <app-foto-pessoa [src]="pessoa.fotoUrl" [nome]="nome" />
              <span>{{ nome }}</span>
            </span>
          }
        </li>
      } @empty {
        <li class="texto-suave">Ninguém.</li>
      }
    </ul>
  `,
  styles: `
    .pessoas {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 0.375rem 0.75rem;

      &--apagadas .pessoa {
        opacity: 0.7;
      }
    }

    .pessoa {
      --foto-tamanho: 1.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      font-size: 0.875rem;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &--botao {
        width: 100%;
        min-height: 44px;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--p-content-border-color);
        border-radius: var(--p-border-radius-md);
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 0.875rem;
        text-align: left;
        cursor: pointer;

        &:hover {
          border-color: var(--p-primary-color);
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaPessoas {
  readonly pessoas = input.required<ComId<Atleta>[]>();
  /** Esmaecidas (ex.: "Não vão", "Faltaram"). */
  readonly apagadas = input(false);
  readonly tocavel = input(false);
  readonly tocar = output<string>();
}
