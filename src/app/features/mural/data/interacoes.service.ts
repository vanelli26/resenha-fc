import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Comentario } from '../../../models/recado.model';
import { AutorPost } from './recados.service';

/** Conversa de um post: mostra os mais antigos primeiro, até este limite. */
const MAX_COMENTARIOS_EXIBIDOS = 200;

/** Curtidas e comentários das postagens do mural (DIRETRIZES 2.8). Qualquer membro. */
@Injectable({ providedIn: 'root' })
export class InteracoesService {
  private readonly firestore = inject(FIRESTORE);

  /** Posts (entre os informados) que eu curti. Uma leitura por post. */
  async minhasCurtidas(timeId: string, recadoIds: string[], uid: string): Promise<Set<string>> {
    const pares = await Promise.all(
      recadoIds.map(async (id): Promise<[string, boolean]> => [
        id,
        (await getDoc(this.curtidaRef(timeId, id, uid))).exists(),
      ]),
    );
    return new Set(pares.filter(([, curtiu]) => curtiu).map(([id]) => id));
  }

  /** Curtir/descurtir: documento da curtida + contador ±1 no post, no mesmo lote (Rules conferem). */
  async definirCurtida(timeId: string, recadoId: string, uid: string, curtir: boolean): Promise<void> {
    const batch = writeBatch(this.firestore);
    if (curtir) batch.set(this.curtidaRef(timeId, recadoId, uid), { criadoEm: serverTimestamp() });
    else batch.delete(this.curtidaRef(timeId, recadoId, uid));
    batch.update(doc(this.firestore, 'times', timeId, 'recados', recadoId), { qtdCurtidas: increment(curtir ? 1 : -1) });
    await batch.commit();
  }

  /** Quantidade de comentários por post (contagem no servidor). */
  async contarComentarios(timeId: string, recadoIds: string[]): Promise<Map<string, number>> {
    const pares = await Promise.all(
      recadoIds.map(async (id): Promise<[string, number]> => [
        id,
        (await getCountFromServer(this.comentarios(timeId, id))).data().count,
      ]),
    );
    return new Map(pares);
  }

  /** Comentários do post em tempo real, mais antigos primeiro. */
  ouvirComentarios(
    timeId: string,
    recadoId: string,
    aoMudar: (comentarios: ComId<Comentario>[]) => void,
    aoFalhar: (erro: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.comentarios(timeId, recadoId), orderBy('criadoEm'), limit(MAX_COMENTARIOS_EXIBIDOS)),
      (snap) => aoMudar(snap.docs.map(comId)),
      aoFalhar,
    );
  }

  async comentar(timeId: string, recadoId: string, texto: string, autor: AutorPost): Promise<void> {
    await setDoc(doc(this.comentarios(timeId, recadoId)), {
      texto,
      autorUid: autor.uid,
      autorNome: autor.nome,
      ...(autor.fotoUrl ? { autorFotoUrl: autor.fotoUrl } : {}),
      criadoEm: serverTimestamp(),
    });
  }

  async excluirComentario(timeId: string, recadoId: string, comentarioId: string): Promise<void> {
    await deleteDoc(doc(this.comentarios(timeId, recadoId), comentarioId));
  }

  private curtidaRef(timeId: string, recadoId: string, uid: string) {
    return doc(this.firestore, 'times', timeId, 'recados', recadoId, 'curtidas', uid);
  }

  private comentarios(timeId: string, recadoId: string) {
    return collection(this.firestore, 'times', timeId, 'recados', recadoId, 'comentarios').withConverter(
      conversor<Comentario>(),
    );
  }
}
