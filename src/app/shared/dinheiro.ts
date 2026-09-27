import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { formatCurrency } from '@angular/common';

// Dinheiro é sempre inteiro em centavos (DIRETRIZES 3.2); reais só na UI.

/** Valor digitado em reais (p-inputnumber) → centavos inteiros. */
export function reaisParaCentavos(reais: number | null): number {
  return Math.round((reais ?? 0) * 100);
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

/** `{{ cobranca.valorCentavos | reais }}` → "R$ 50,00". */
@Pipe({ name: 'reais' })
export class ReaisPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(centavos: number): string {
    return formatCurrency(centavos / 100, this.locale, 'R$', 'BRL');
  }
}
