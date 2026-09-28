import { Injectable, inject } from '@angular/core';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Escalacao, Titular } from '../../../models/escalacao.model';

/** times/{timeId}/eventos/{eventoId}/escalacao/principal. Leitura: todos do time. Escrita: diretoria. */
@Injectable({ providedIn: 'root' })
export class EscalacaoService {
  private readonly firestore = inject(FIRESTORE);

  async obter(timeId: string, eventoId: string): Promise<Escalacao | null> {
    const snap = await getDoc(this.ref(timeId, eventoId));
    return snap.data() ?? null;
  }

  async salvar(timeId: string, eventoId: string, formacao: string, titulares: Titular[], uid: string): Promise<void> {
    await setDoc(this.ref(timeId, eventoId), {
      formacao,
      titulares,
      atualizadoPor: uid,
      atualizadoEm: serverTimestamp(),
    });
  }

  async limpar(timeId: string, eventoId: string): Promise<void> {
    await deleteDoc(this.ref(timeId, eventoId));
  }

  private ref(timeId: string, eventoId: string) {
    return doc(this.firestore, 'times', timeId, 'eventos', eventoId, 'escalacao', 'principal').withConverter(
      conversor<Escalacao>(),
    );
  }
}
