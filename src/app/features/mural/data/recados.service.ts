import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Recado } from '../../../models/recado.model';

/** Mural mostra os mais recentes; recado antigo perde relevância (DIRETRIZES 7: toda listagem com limite). */
export const MAX_RECADOS = 50;

export interface DadosRecado {
  titulo: string;
  texto: string;
  fixado: boolean;
}

/** times/{timeId}/recados. Leitura: todos do time (em tempo real). Escrita: diretoria. */
@Injectable({ providedIn: 'root' })
export class RecadosService {
  private readonly firestore = inject(FIRESTORE);

  /** Fixados primeiro, depois os mais novos. Índice composto fixado desc + criadoEm desc. */
  ouvir(
    timeId: string,
    aoMudar: (recados: ComId<Recado>[]) => void,
    aoFalhar: (erro: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.colecao(timeId), orderBy('fixado', 'desc'), orderBy('criadoEm', 'desc'), limit(MAX_RECADOS)),
      (snap) => aoMudar(snap.docs.map(comId)),
      aoFalhar,
    );
  }

  async criar(timeId: string, dados: DadosRecado, autor: { uid: string; nome: string }): Promise<void> {
    await addDoc(collection(this.firestore, 'times', timeId, 'recados'), {
      ...dados,
      autorUid: autor.uid,
      autorNome: autor.nome,
      criadoEm: serverTimestamp(),
    });
  }

  async atualizar(timeId: string, recadoId: string, dados: DadosRecado): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId, 'recados', recadoId), { ...dados });
  }

  async excluir(timeId: string, recadoId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'times', timeId, 'recados', recadoId));
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'recados').withConverter(conversor<Recado>());
  }
}
