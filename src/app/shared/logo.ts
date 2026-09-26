import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ModoTemaService } from '../core/theme/modo-tema.service';

/**
 * Marca oficial do ResenhaFC (arquivos em `public/marca/`), na versão do modo claro/escuro.
 * `compactoNoCelular`: em telas estreitas mostra só o ícone. Altura por `--logo-altura`.
 */
@Component({
  selector: 'app-logo',
  template: `
    <picture>
      @if (compactoNoCelular()) {
        <source media="(max-width: 480px)" srcset="marca/icone.svg" />
      }
      <img
        [src]="modoTema.escuro() ? 'marca/logo-fundo-escuro.svg' : 'marca/logo-fundo-claro.svg'"
        alt="ResenhaFC"
      />
    </picture>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    picture {
      display: contents;
    }
    img {
      display: block;
      height: var(--logo-altura, 2.25rem);
      width: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  protected readonly modoTema = inject(ModoTemaService);

  readonly compactoNoCelular = input(false);
}
