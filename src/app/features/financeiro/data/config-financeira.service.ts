import { Injectable, inject } from '@angular/core';
import { doc, updateDoc } from 'firebase/firestore';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { ConfigFinanceira } from '../../../models/time.model';

export type ModalidadesFinanceiras = Pick<ConfigFinanceira, 'mensal' | 'semestral' | 'avulso'>;

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
}
