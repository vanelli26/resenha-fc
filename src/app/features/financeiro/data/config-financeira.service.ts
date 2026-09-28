import { Injectable, inject } from '@angular/core';
import { doc, updateDoc } from 'firebase/firestore';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { TimeAtualService } from '../../../core/time/time-atual.service';
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
  private readonly timeAtual = inject(TimeAtualService);

  /**
   * Altera parte da configuração do time atual e grava o objeto inteiro (planos, vencimentos e despesas),
   * sempre no formato de planos: a primeira gravação de um time antigo já converte (DIRETRIZES 2.4).
   * Em seguida atualiza o contexto do time, sem nova leitura.
   */
  async atualizar(parcial: Partial<ConfigFinanceira>): Promise<void> {
    const time = this.timeAtual.time();
    if (!time) throw new Error('Nenhum time selecionado.');
    const financeiro: ConfigFinanceira = { ...time.financeiro, ...parcial };
    await updateDoc(doc(this.firestore, 'times', time.id), { financeiro });
    this.timeAtual.definirFinanceiro(financeiro);
  }
}
