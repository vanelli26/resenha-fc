import { Injectable, inject } from '@angular/core';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Acesso } from '../../../models/acesso.model';
import { PapelTime } from '../../../models/papel.model';
import { VinculoAtleta } from '../../elenco/data/atletas.service';

export interface DadosMembro {
  uid: string;
  nome: string;
  papeis: PapelTime[];
  /** null = não está no elenco. Independente do papel `jogador` (DIRETRIZES, seção 10). */
  vinculo: VinculoAtleta | null;
  /** atletaId vinculado antes da edição (null para membro novo ou sem vínculo). */
  atletaIdAnterior: string | null;
}

/** times/{timeId}/acessos — membros e papéis. Escrita: diretoria do time ou adminGeral. */
@Injectable({ providedIn: 'root' })
export class AcessosService {
  private readonly firestore = inject(FIRESTORE);

  async listar(timeId: string): Promise<ComId<Acesso>[]> {
    const snap = await getDocs(query(this.colecao(timeId).withConverter(conversor<Acesso>()), orderBy('nome')));
    return snap.docs.map(comId);
  }

  /**
   * Cria ou atualiza o acesso e ajusta o vínculo com o elenco na mesma escrita em lote:
   * desvincula o atleta anterior (uid = null), vincula o escolhido ou cria um novo.
   */
  async salvar(time: { id: string; nome: string }, dados: DadosMembro, concedidoPor: string): Promise<void> {
    const timeRef = doc(this.firestore, 'times', time.id);
    const atletas = collection(timeRef, 'atletas');
    const batch = writeBatch(this.firestore);

    const destino = dados.vinculo;
    const mantemVinculo = destino?.tipo === 'existente' && destino.atletaId === dados.atletaIdAnterior;
    let atletaId: string | null = mantemVinculo ? dados.atletaIdAnterior : null;

    if (!mantemVinculo) {
      if (dados.atletaIdAnterior) {
        batch.update(doc(atletas, dados.atletaIdAnterior), { uid: null, atualizadoEm: serverTimestamp() });
      }
      if (destino?.tipo === 'existente') {
        atletaId = destino.atletaId;
        batch.update(doc(atletas, atletaId), { uid: dados.uid, atualizadoEm: serverTimestamp() });
      } else if (destino?.tipo === 'novo') {
        const novo = doc(atletas);
        atletaId = novo.id;
        batch.set(novo, {
          nome: dados.nome,
          apelido: '',
          uid: dados.uid,
          modalidade: destino.modalidade,
          posicoes: [],
          status: 'ativo',
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
      }
    }

    batch.set(doc(timeRef, 'acessos', dados.uid), {
      uid: dados.uid,
      timeId: time.id,
      timeNome: time.nome,
      nome: dados.nome,
      papeis: dados.papeis,
      atletaId,
      concedidoPor,
      atualizadoEm: serverTimestamp(),
    });
    await batch.commit();
  }

  /** Remove o acesso e libera o atleta vinculado (continua no elenco, sem conta). */
  async remover(timeId: string, membro: Acesso): Promise<void> {
    // Vínculo pode apontar para atleta inexistente (dado inconsistente): nesse caso só remove o acesso.
    const atletaRef = membro.atletaId ? doc(this.firestore, 'times', timeId, 'atletas', membro.atletaId) : null;
    if (!atletaRef || !(await getDoc(atletaRef)).exists()) {
      await deleteDoc(doc(this.colecao(timeId), membro.uid));
      return;
    }
    const batch = writeBatch(this.firestore);
    batch.update(atletaRef, { uid: null, atualizadoEm: serverTimestamp() });
    batch.delete(doc(this.colecao(timeId), membro.uid));
    await batch.commit();
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'acessos');
  }
}
