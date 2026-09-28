import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface AbaSecao {
  rotulo: string;
  link: readonly (string | null)[];
  /** Mantém os parâmetros da URL ao trocar de aba (ex.: período do financeiro). */
  manterParametros?: boolean;
  /** Ativa só na rota exata (aba cujo link é prefixo de outra, ex.: Elenco × Elenco › Artilharia). */
  exata?: boolean;
}

/** Abas internas de uma seção do time (ex.: Cobranças | Caixa, Elenco | Artilharia), por rota. */
@Component({
  selector: 'app-abas-secao',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="abas" [attr.aria-label]="rotulo()">
      @for (aba of abas(); track aba.rotulo) {
        <a
          class="abas__item"
          [routerLink]="aba.link"
          [queryParamsHandling]="aba.manterParametros ? 'preserve' : ''"
          routerLinkActive="abas__item--ativa"
          [routerLinkActiveOptions]="{ exact: !!aba.exata }"
          ariaCurrentWhenActive="page"
        >
          {{ aba.rotulo }}
        </a>
      }
    </nav>
  `,
  styles: `
    .abas {
      display: grid;
      grid-auto-columns: 1fr;
      grid-auto-flow: column;
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
export class AbasSecao {
  readonly abas = input.required<AbaSecao[]>();
  readonly rotulo = input.required<string>();
}
