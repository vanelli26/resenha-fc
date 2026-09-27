import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

/** Logo do apoiador em quadro claro (logos costumam ser feitos para fundo branco). Sem logo: inicial. */
@Component({
  selector: 'app-logo-patrocinador',
  template: `
    @if (src() && !falhou()) {
      <img [src]="src()" [alt]="'Logo ' + nome()" (error)="falhou.set(true)" />
    } @else {
      <span aria-hidden="true">{{ inicial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: var(--logo-tamanho, 3.5rem);
      height: var(--logo-tamanho, 3.5rem);
      flex-shrink: 0;
      padding: 0.25rem;
      border-radius: var(--p-border-radius-lg);
      border: 1px solid var(--p-content-border-color);
      background: var(--p-surface-0);
      color: var(--p-surface-900);
      font-weight: 700;
      overflow: hidden;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoPatrocinador {
  readonly src = input<string | null>(null);
  readonly nome = input('');

  protected readonly falhou = linkedSignal({ source: this.src, computation: () => false });
  protected readonly inicial = computed(() => this.nome().trim().charAt(0).toUpperCase() || '?');
}
