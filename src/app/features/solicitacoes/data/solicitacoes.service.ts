import { Injectable, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getCountFromServer,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Acesso } from '../../../models/acesso.model';
import { Solicitacao } from '../../../models/convite.model';
import { PapelTime } from '../../../models/papel.model';
import { VinculoAtleta } from '../../elenco/data/atletas.service';


/** times/{timeId}/solicitacoes/{uid}. */
@Injectable({ providedIn: 'root' })
export class SolicitacoesService {
  private readonly firestore = inject(FIRESTORE);
  private readonly _qtdPendentes = signal(0);

  /** Contador para o selo da aba "Solicitações" do time atual. */
  readonly qtdPendentes = this._qtdPendentes.asReadonly();

  async listarPendentes(timeId: string): Promise<ComId<Solicitacao>[]> {
    const snap = await getDocs(this.pendentes(timeId).withConverter(conversor<Solicitacao>()));
    this._qtdPendentes.set(snap.size);
    return snap.docs.map(comId).sort((a, b) => a.criadoEm.toMillis() - b.criadoEm.toMillis());
  }

  /** Agregação no servidor: não lê os documentos. */
  async contarPendentes(timeId: string): Promise<void> {
    const snap = await getCountFromServer(this.pendentes(timeId));
    this._qtdPendentes.set(snap.data().count);
  }

  async obterMinha(timeId: string, uid: string): Promise<Solicitacao | null> {
    const snap = await getDoc(doc(this.colecao(timeId), uid).withConverter(conversor<Solicitacao>()));
    return snap.exists() ? snap.data() : null;
  }

  async criar(timeId: string, codigoConvite: string, usuario: { uid: string; nome: string; email: string }): Promise<void> {
    await setDoc(doc(this.colecao(timeId), usuario.uid), {
      nome: usuario.nome,
      email: usuario.email,
      status: 'pendente',
      convite: codigoConvite,
      criadoEm: serverTimestamp(),
    });
  }

  /**
   * Em uma escrita em lote: atleta (novo ou vinculado), acesso com papel jogador
   * (mantendo papéis que a pessoa já tenha) e solicitação aprovada (DIRETRIZES 2.11).
   */
  async aprovar(
    time: { id: string; nome: string },
    solicitacao: ComId<Solicitacao>,
    vinculo: VinculoAtleta,
    concedidoPor: string,
  ): Promise<void> {
    const uid = solicitacao.id;
    const timeRef = doc(this.firestore, 'times', time.id);
    const acessoRef = doc(timeRef, 'acessos', uid).withConverter(conversor<Acesso>());
    const acessoAtual = await getDoc(acessoRef);
    const papeis: PapelTime[] = [...new Set<PapelTime>([...(acessoAtual.data()?.papeis ?? []), 'jogador'])];

    const batch = writeBatch(this.firestore);
    const atletas = collection(timeRef, 'atletas');
    const atletaRef = vinculo.tipo === 'existente' ? doc(atletas, vinculo.atletaId) : doc(atletas);

    if (vinculo.tipo === 'novo') {
      batch.set(atletaRef, {
        nome: solicitacao.nome,
        apelido: '',
        uid,
        modalidade: vinculo.modalidade,
        posicoes: {},
        vinculo: vinculo.vinculo,
        status: 'ativo',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
    } else {
      batch.update(atletaRef, { uid, atualizadoEm: serverTimestamp() });
    }

    batch.set(doc(timeRef, 'acessos', uid), {
      uid,
      timeId: time.id,
      timeNome: time.nome,
      nome: solicitacao.nome,
      papeis,
      atletaId: atletaRef.id,
      concedidoPor,
      atualizadoEm: serverTimestamp(),
    });
    batch.update(doc(this.colecao(time.id), uid), { status: 'aprovada' });
    await batch.commit();
  }

  async recusar(timeId: string, uid: string): Promise<void> {
    await updateDoc(doc(this.colecao(timeId), uid), { status: 'recusada' });
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'solicitacoes');
  }

  private pendentes(timeId: string) {
    return query(this.colecao(timeId), where('status', '==', 'pendente'));
  }
}
