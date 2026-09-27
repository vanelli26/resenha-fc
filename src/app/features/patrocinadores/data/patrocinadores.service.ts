import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { MAX_PATROCINADORES, Patrocinador } from '../../../models/patrocinador.model';

export interface DadosPatrocinador {
  nome: string;
  logo: string | null;
  link?: string;
}

/** Aceita "instagram.com/x" ou "https://…"; devolve https ou undefined (vazio). */
export function normalizarLink(valor: string): string | undefined {
  const texto = valor.trim();
  if (!texto) return undefined;
  return /^https?:\/\//i.test(texto) ? texto.replace(/^http:\/\//i, 'https://') : `https://${texto}`;
}

/** times/{timeId}/patrocinadores. Leitura: todos do time. Escrita: diretoria. */
@Injectable({ providedIn: 'root' })
export class PatrocinadoresService {
  private readonly firestore = inject(FIRESTORE);

  async listar(timeId: string): Promise<ComId<Patrocinador>[]> {
    const snap = await getDocs(query(this.colecao(timeId), orderBy('ordem'), limit(MAX_PATROCINADORES)));
    return snap.docs.map(comId);
  }

  async criar(timeId: string, dados: DadosPatrocinador, ordem: number): Promise<void> {
    await setDoc(doc(this.colecao(timeId)), {
      nome: dados.nome,
      logo: dados.logo,
      ...(dados.link ? { link: dados.link } : {}),
      ordem,
      criadoEm: serverTimestamp(),
    });
  }

  async atualizar(timeId: string, id: string, dados: DadosPatrocinador): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId, 'patrocinadores', id), {
      nome: dados.nome,
      logo: dados.logo,
      link: dados.link ?? deleteField(),
    });
  }

  async excluir(timeId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'times', timeId, 'patrocinadores', id));
  }

  /** Regrava a ordem de todos (posição na lista), num lote. */
  async reordenar(timeId: string, ids: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    ids.forEach((id, ordem) => batch.update(doc(this.firestore, 'times', timeId, 'patrocinadores', id), { ordem }));
    await batch.commit();
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'patrocinadores').withConverter(conversor<Patrocinador>());
  }
}
