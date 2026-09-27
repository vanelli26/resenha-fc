import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TimeAtualService } from '../../core/time/time-atual.service';

/** Alternância entre as telas do financeiro da gestão (Cobranças | Caixa), mantendo o período da URL. */
@Component({
  selector: 'app-financeiro-abas',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="abas" aria-label="Financeiro">
      <a class="abas__item" [routerLink]="base().concat('cobrancas')" queryParamsHandling="preserve" routerLinkActive="abas__item--ativa" ariaCurrentWhenActive="page">
        Cobranças
      </a>
      <a class="abas__item" [routerLink]="base().concat('caixa')" queryParamsHandling="preserve" routerLinkActive="abas__item--ativa" ariaCurrentWhenActive="page">
        Caixa
      </a>
    </nav>
  `,
  styles: `
    .abas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem;
      margin-bottom: 1rem;
      padding: 0.25rem;
      border-radius: var(--p-border-radius-lg);
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
    }
    .abas__item {
      display: grid;
      place-items: center;
      min-height: 2.5rem;
      border-radius: var(--p-border-radius-md);
      color: var(--p-text-muted-color);
      text-decoration: none;
      font-weight: 600;

      &:focus-visible {
        outline: 2px solid var(--p-primary-color);
        outline-offset: -2px;
      }
    }
    .abas__item--ativa {
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceiroAbas {
  private readonly timeId = inject(TimeAtualService).timeId;
  protected readonly base = computed(() => ['/t', this.timeId(), 'financeiro']);
}
