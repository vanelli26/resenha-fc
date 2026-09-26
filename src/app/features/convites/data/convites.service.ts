import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Convite } from '../../../models/convite.model';

export const VALIDADE_CONVITE_DIAS = 7;
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TAMANHO_CODIGO = 12;

/** times/{timeId}/convites/{codigo}. */
@Injectable({ providedIn: 'root' })
export class ConvitesService {
  private readonly firestore = inject(FIRESTORE);

  /** Diretoria: últimos convites do time. */
  async listar(timeId: string): Promise<ComId<Convite>[]> {
    const snap = await getDocs(
      query(this.colecao(timeId).withConverter(conversor<Convite>()), orderBy('criadoEm', 'desc'), limit(20)),
    );
    return snap.docs.map(comId);
  }

  /** Qualquer usuário logado lê um convite pelo código (get, nunca list). */
  async obter(timeId: string, codigo: string): Promise<Convite | null> {
    const snap = await getDoc(doc(this.colecao(timeId), codigo).withConverter(conversor<Convite>()));
    return snap.exists() ? snap.data() : null;
  }

  async criar(time: { id: string; nome: string }, criadoPor: string): Promise<string> {
    const codigo = gerarCodigo();
    const expiraEm = Timestamp.fromMillis(Date.now() + VALIDADE_CONVITE_DIAS * 24 * 60 * 60 * 1000);
    await setDoc(doc(this.colecao(time.id), codigo), {
      timeNome: time.nome,
      ativo: true,
      expiraEm,
      criadoPor,
      criadoEm: serverTimestamp(),
    });
    return codigo;
  }

  async desativar(timeId: string, codigo: string): Promise<void> {
    await updateDoc(doc(this.colecao(timeId), codigo), { ativo: false });
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'convites');
  }
}

export function conviteValido(convite: Convite): boolean {
  return convite.ativo && convite.expiraEm.toMillis() > Date.now();
}

function gerarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TAMANHO_CODIGO));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}
