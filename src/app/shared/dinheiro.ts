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

/**
 * Divide um total em `partes` valores inteiros que somam exatamente o total; os centavos que sobram
 * vão, um a um, para as primeiras partes (ex.: 10000 em 3 → 3334, 3333, 3333).
 */
export function ratearCentavos(total: number, partes: number): number[] {
  if (partes <= 0) return [];
  const base = Math.floor(total / partes);
  const sobra = total - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < sobra ? 1 : 0));
}

/** Centavos → "R$ 50,00" (texto fora do template, ex.: mensagens). */
export function formatarReais(centavos: number, locale: string): string {
  return formatCurrency(centavos / 100, locale, 'R$', 'BRL');
}

/** `{{ cobranca.valorCentavos | reais }}` → "R$ 50,00". */
@Pipe({ name: 'reais' })
export class ReaisPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(centavos: number): string {
    return formatarReais(centavos, this.locale);
  }
}
