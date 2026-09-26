import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

/**
 * Foto de perfil redonda (ex.: foto do Google). `referrerpolicy="no-referrer"` porque o
 * googleusercontent responde 403 com Referer de outro domínio. Sem foto ou com erro, mostra a inicial.
 */
@Component({
  selector: 'app-foto-pessoa',
  template: `
    @if (src() && !falhou()) {
      <img [src]="src()" alt="" referrerpolicy="no-referrer" (error)="falhou.set(true)" />
    } @else {
      <span aria-hidden="true">{{ inicial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: var(--foto-tamanho, 2.5rem);
      height: var(--foto-tamanho, 2.5rem);
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: var(--p-surface-700);
      color: var(--p-surface-0);
      font-weight: 600;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FotoPessoa {
  readonly src = input<string | null | undefined>(null);
  readonly nome = input.required<string>();

  protected readonly falhou = linkedSignal({ source: this.src, computation: () => false });
  protected readonly inicial = computed(() => this.nome().charAt(0).toUpperCase() || '?');
}
