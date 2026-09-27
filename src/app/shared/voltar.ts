import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft } from '@primeicons/angular/arrow-left';
import { TimeAtualService } from '../core/time/time-atual.service';

/** Link "← Voltar" para uma seção do time atual (ex.: `para="gestao"` → /t/:timeId/gestao). */
@Component({
  selector: 'app-voltar',
  imports: [RouterLink, ArrowLeft],
  template: `
    <a class="voltar" [routerLink]="link()">
      <svg data-p-icon="arrow-left" [size]="14" aria-hidden="true"></svg>
      {{ rotulo() }}
    </a>
  `,
  styles: `
    .voltar {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 2.75rem;
      color: var(--p-text-muted-color);
      text-decoration: none;
      font-size: 0.875rem;

      &:hover {
        color: var(--p-text-color);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Voltar {
  private readonly timeId = inject(TimeAtualService).timeId;

  readonly para = input.required<string>();
  readonly rotulo = input('Voltar');

  protected readonly link = computed(() => ['/t', this.timeId(), ...this.para().split('/')]);
}
