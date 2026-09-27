import { Injectable, inject } from '@angular/core';
import { doc, updateDoc } from 'firebase/firestore';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { ConfigFinanceira, DespesaRecorrente } from '../../../models/time.model';

export type ModalidadesFinanceiras = Pick<ConfigFinanceira, 'mensal' | 'semestral' | 'avulso'>;

/** Limite das Rules (validam item a item, sem laço). */
export const MAX_DESPESAS_RECORRENTES = 10;

/** ID da despesa recorrente: minúsculas e dígitos (entra no ID do lançamento `rec_{id}_{AAAA-MM}`). */
export function novoIdRecorrente(): string {
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

/** times/{timeId}.financeiro. Escrita: tesouraria ou adminGeral (Rules validam cada campo). */
@Injectable({ providedIn: 'root' })
export class ConfigFinanceiraService {
  private readonly firestore = inject(FIRESTORE);

  /** Grava só as modalidades; as despesas recorrentes ficam como estão. */
  async salvarModalidades(timeId: string, dados: ModalidadesFinanceiras): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId), {
      'financeiro.mensal': dados.mensal,
      'financeiro.semestral': dados.semestral,
      'financeiro.avulso': dados.avulso,
    });
  }

  /** Substitui a lista inteira de despesas recorrentes; as modalidades ficam como estão. */
  async salvarDespesas(timeId: string, despesas: DespesaRecorrente[]): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId), { 'financeiro.despesasRecorrentes': despesas });
  }
}
