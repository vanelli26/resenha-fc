import { Injectable, inject } from '@angular/core';
import { doc, updateDoc } from 'firebase/firestore';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { ConfigFinanceira } from '../../../models/time.model';

/** Limites das Rules (validam item a item, sem laço). */
export const MAX_DESPESAS_RECORRENTES = 10;
export const MAX_PLANOS = 10;

/** ID de plano ou despesa recorrente: minúsculas e dígitos (entra em IDs como `rec_{id}_{AAAA-MM}`). */
export function novoIdConfiguracao(): string {
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

/** times/{timeId}.financeiro. Escrita: tesouraria ou adminGeral (Rules validam cada campo). */
@Injectable({ providedIn: 'root' })
export class ConfigFinanceiraService {
  private readonly firestore = inject(FIRESTORE);

  /**
   * Grava a configuração inteira (planos, vencimentos e despesas). Sempre no formato de planos:
   * a primeira gravação de um time antigo já converte o formato (DIRETRIZES 2.4).
   */
  async salvar(timeId: string, financeiro: ConfigFinanceira): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId), { financeiro });
  }
}
