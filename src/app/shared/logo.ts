import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Marca do ResenhaFC: bola em forma de balão de conversa ("resenha") + nome.
 * Usa a cor primária do tema, então acompanha a cor do time atual.
 * Tamanho por `--logo-tamanho`; o nome pode ser ocultado com `--logo-nome: none`.
 */
@Component({
  selector: 'app-logo',
  template: `
    <svg class="marca" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path class="marca__bola" d="M16 3a12 12 0 1 1-6.9 21.8L4 27l1.6-5.3A12 12 0 0 1 16 3z" />
      <path class="marca__gomos" d="M16 10.8 20 13.7 18.5 18.4h-5L12 13.7zM16.0 6.6L19.0 5.2 20.3 4.2A11.6 11.6 0 0 0 11.7 4.2L13.0 5.2zM24.0 12.4L26.2 14.8 27.6 15.8A11.6 11.6 0 0 0 24.9 7.5L24.4 9.1zM20.9 21.8L19.3 24.6 18.8 26.3A11.6 11.6 0 0 0 25.8 21.1L24.1 21.1zM11.1 21.8L7.9 21.1 6.2 21.1A11.6 11.6 0 0 0 13.2 26.3L12.7 24.6zM8.0 12.4L7.6 9.1 7.1 7.5A11.6 11.6 0 0 0 4.4 15.8L5.8 14.8z" />
      <path class="marca__costura" d="M16 10.8V6.6M20 13.7l4-1.3M18.5 18.4l2.4 3.4M13.5 18.4l-2.4 3.4M12 13.7l-4-1.3" />
    </svg>
    <span class="nome">Resenha<span class="nome__fc">FC</span></span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--p-text-color);
    }
    .marca {
      width: var(--logo-tamanho, 2rem);
      height: var(--logo-tamanho, 2rem);
      flex-shrink: 0;
    }
    .marca__bola {
      fill: var(--p-primary-color);
    }
    .marca__gomos {
      fill: var(--p-primary-contrast-color);
    }
    .marca__costura {
      fill: none;
      stroke: var(--p-primary-contrast-color);
      stroke-width: 1.4;
      stroke-linecap: round;
    }
    .nome {
      display: var(--logo-nome, inline);
      font-size: calc(var(--logo-tamanho, 2rem) * 0.6);
      font-weight: 800;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .nome__fc {
      color: var(--p-primary-color);
    }
  `,
  host: { role: 'img', 'aria-label': 'ResenhaFC' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {}
