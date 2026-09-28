import { Injectable, inject } from '@angular/core';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Campeonato, MAX_CAMPEONATOS_LISTADOS } from '../../../models/campeonato.model';

export type DadosCampeonato = Pick<Campeonato, 'nome' | 'temporada' | 'status'>;

/** times/{timeId}/campeonatos. Leitura: todos do time. Escrita: diretoria (sem exclusão). */
@Injectable({ providedIn: 'root' })
export class CampeonatosService {
  private readonly firestore = inject(FIRESTORE);

  /** Mais recentes primeiro. */
  async listar(timeId: string): Promise<ComId<Campeonato>[]> {
    const snap = await getDocs(query(this.colecao(timeId), orderBy('criadoEm', 'desc'), limit(MAX_CAMPEONATOS_LISTADOS)));
    return snap.docs.map(comId);
  }

  async obter(timeId: string, campeonatoId: string): Promise<ComId<Campeonato> | null> {
    const snap = await getDoc(doc(this.colecao(timeId), campeonatoId));
    const dados = snap.data();
    return dados ? { ...dados, id: snap.id } : null;
  }

  async criar(timeId: string, dados: DadosCampeonato): Promise<string> {
    const ref = await addDoc(collection(this.firestore, 'times', timeId, 'campeonatos'), {
      ...dados,
      criadoEm: serverTimestamp(),
    });
    return ref.id;
  }

  async atualizar(timeId: string, campeonatoId: string, dados: DadosCampeonato): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId, 'campeonatos', campeonatoId), { ...dados });
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'campeonatos').withConverter(conversor<Campeonato>());
  }
}
