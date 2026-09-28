import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { PedidoTime } from '../../../models/pedido-time.model';
import { CorTime } from '../../../models/time.model';
import { FINANCEIRO_PADRAO } from './times.service';

/** Teto da lista do admin (pedidos mais recentes). */
const MAX_PEDIDOS_LISTADOS = 100;

export interface NovoPedidoTime {
  slug: string;
  nome: string;
  cor: CorTime;
}

export interface Solicitante {
  uid: string;
  nome: string;
  email: string;
}

/**
 * pedidosTime (DIRETRIZES 2.12). Quem pede: cria, acompanha e dispensa o próprio pedido; aprovado, cria o time.
 * adminGeral: lista e decide.
 */
@Injectable({ providedIn: 'root' })
export class PedidosTimeService {
  private readonly firestore = inject(FIRESTORE);

  /** Falha (permissão) se o endereço já for de um time ou de outro pedido. */
  async pedir(pedido: NovoPedidoTime, quem: Solicitante): Promise<void> {
    await setDoc(doc(this.colecao(), pedido.slug), {
      nome: pedido.nome,
      cor: pedido.cor,
      solicitanteUid: quem.uid,
      solicitanteNome: quem.nome,
      solicitanteEmail: quem.email,
      status: 'pendente',
      criadoEm: serverTimestamp(),
    });
  }

  /** Pedidos da própria pessoa (mesmo filtro que as Rules exigem). */
  async meus(uid: string): Promise<ComId<PedidoTime>[]> {
    const snap = await getDocs(query(this.colecao(), where('solicitanteUid', '==', uid)));
    return snap.docs.map(comId).sort((a, b) => (b.criadoEm?.toMillis() ?? 0) - (a.criadoEm?.toMillis() ?? 0));
  }

  /** adminGeral: todos, mais recentes primeiro. */
  async listar(): Promise<ComId<PedidoTime>[]> {
    const snap = await getDocs(query(this.colecao(), orderBy('criadoEm', 'desc'), limit(MAX_PEDIDOS_LISTADOS)));
    return snap.docs.map(comId);
  }

  async decidir(slug: string, aprovado: boolean, motivo: string, adminUid: string): Promise<void> {
    await updateDoc(doc(this.colecao(), slug), {
      status: aprovado ? 'aprovado' : 'reprovado',
      ...(!aprovado && motivo ? { motivo } : {}),
      decididoEm: serverTimestamp(),
      decididoPor: adminUid,
    });
  }

  /** Cancelar pedido pendente ou dispensar o aviso de reprovado. */
  async dispensar(slug: string): Promise<void> {
    await deleteDoc(doc(this.colecao(), slug));
  }

  /**
   * Pedido aprovado: cria o time (nome e cor do pedido) e o acesso de quem pediu como diretoria e tesouraria,
   * no mesmo lote (Rules conferem o pedido).
   */
  async criarTime(pedido: ComId<PedidoTime>, quem: Solicitante): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.set(doc(this.firestore, 'times', pedido.id), {
      nome: pedido.nome,
      slug: pedido.id,
      cor: pedido.cor,
      escudo: null,
      financeiro: FINANCEIRO_PADRAO,
      criadoEm: serverTimestamp(),
    });
    batch.set(doc(this.firestore, 'times', pedido.id, 'acessos', quem.uid), {
      uid: quem.uid,
      timeId: pedido.id,
      timeNome: pedido.nome,
      nome: quem.nome || quem.email,
      papeis: ['diretoria', 'tesouraria'],
      atletaId: null,
      concedidoPor: quem.uid,
      atualizadoEm: serverTimestamp(),
    });
    await batch.commit();
  }

  private colecao() {
    return collection(this.firestore, 'pedidosTime').withConverter(conversor<PedidoTime>());
  }
}
