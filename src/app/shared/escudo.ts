import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

/** Escudo do time (data URL). Sem imagem ou com erro de carga, mostra a inicial. */
@Component({
  selector: 'app-escudo',
  template: `
    @if (src() && !falhou()) {
      <img [src]="src()" [alt]="'Escudo ' + nome()" (error)="falhou.set(true)" />
    } @else {
      <span aria-hidden="true">{{ inicial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: var(--escudo-tamanho, 2.5rem);
      height: var(--escudo-tamanho, 2.5rem);
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: var(--p-surface-800);
      color: var(--p-surface-0);
      font-weight: 700;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Escudo {
  readonly src = input<string>('');
  readonly nome = input.required<string>();

  // Volta a tentar quando a imagem muda.
  protected readonly falhou = linkedSignal({ source: this.src, computation: () => false });
  protected readonly inicial = computed(() => this.nome().charAt(0).toUpperCase());
}
