import { Injectable, inject } from '@angular/core';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import {
  Escalacao,
  FORMACOES_POR_ESPORTE,
  NOMES_TIMES_PADRAO,
  escalacaoAberta,
  ocupacaoDaEscalacao,
} from '../../../models/escalacao.model';
import { Esporte } from '../../../models/posicao.model';

/**
 * times/{timeId}/eventos/{eventoId}/escalacao/principal. Leitura: todos do time. Diretoria: monta, fecha e limpa.
 * Aberta: quem disse "Vou" escolhe a própria vaga (DIRETRIZES 2.9).
 */
export interface DadosEscalacao {
  formacao: string;
  /** Chave da vaga ("3", "b3") → atletaId. */
  ocupacao: ReadonlyMap<string, string>;
  fechada: boolean;
  nomes: [string, string] | null;
}

@Injectable({ providedIn: 'root' })
export class EscalacaoService {
  private readonly firestore = inject(FIRESTORE);

  async obter(timeId: string, eventoId: string): Promise<Escalacao | null> {
    const snap = await getDoc(this.ref(timeId, eventoId));
    return snap.data() ?? null;
  }

  /** Tempo real (evento e escalação): a escalação aparece conforme é montada. Retorna a função de parar. */
  ouvir(
    timeId: string,
    eventoId: string,
    aoMudar: (escalacao: Escalacao | null) => void,
    aoFalhar: (erro: Error) => void,
  ): () => void {
    return onSnapshot(this.ref(timeId, eventoId), (snap) => aoMudar(snap.data() ?? null), aoFalhar);
  }

  /** Diretoria: grava a escalação inteira (sempre no formato novo). `nomes` = dois times; null = um time. */
  async salvar(timeId: string, eventoId: string, dados: DadosEscalacao, uid: string): Promise<void> {
    await setDoc(this.ref(timeId, eventoId), {
      formacao: dados.formacao,
      vagas: Object.fromEntries(dados.ocupacao),
      fechada: dados.fechada,
      ...(dados.nomes ? { nomes: dados.nomes } : {}),
      atualizadoPor: uid,
      atualizadoEm: serverTimestamp(),
    });
  }

  /** Diretoria: fecha (só ela mexe) ou abre para os jogadores. */
  async definirFechada(timeId: string, eventoId: string, fechada: boolean, uid: string): Promise<void> {
    await updateDoc(this.ref(timeId, eventoId), { fechada, atualizadoPor: uid, atualizadoEm: serverTimestamp() });
  }

  /**
   * Jogador confirmado: entra na vaga livre (chave "3" ou "b3"; sai da anterior) ou, com `vaga` null, sai do
   * campinho. Transação: se alguém ocupou a vaga antes, falha com aviso. Sem escalação, cria com a formação padrão
   * do esporte e, se `doisTimes`, com os nomes padrão.
   */
  async escolherVaga(
    timeId: string,
    eventoId: string,
    novo: { esporte: Esporte; doisTimes: boolean },
    atletaId: string,
    vaga: string | null,
    uid: string,
  ): Promise<void> {
    const ref = this.ref(timeId, eventoId);
    await runTransaction(this.firestore, async (tx) => {
      const atual = (await tx.get(ref)).data() ?? null;
      if (!atual) {
        if (vaga === null) return;
        tx.set(ref, {
          formacao: FORMACOES_POR_ESPORTE[novo.esporte][0],
          vagas: { [vaga]: atletaId },
          fechada: false,
          ...(novo.doisTimes ? { nomes: [...NOMES_TIMES_PADRAO] } : {}),
          atualizadoPor: uid,
          atualizadoEm: serverTimestamp(),
        });
        return;
      }
      if (!escalacaoAberta(atual)) throw new Error('A escalação foi fechada pela diretoria.');
      const ocupacao = ocupacaoDaEscalacao(atual);
      const minha = [...ocupacao].find(([, id]) => id === atletaId)?.[0];
      if (vaga !== null && ocupacao.has(vaga) && ocupacao.get(vaga) !== atletaId) {
        throw new Error('Essa vaga acabou de ser ocupada. Escolha outra.');
      }
      if (vaga === minha) return;
      tx.update(ref, {
        ...(minha !== undefined ? { [`vagas.${minha}`]: deleteField() } : {}),
        ...(vaga !== null ? { [`vagas.${vaga}`]: atletaId } : {}),
        atualizadoPor: uid,
        atualizadoEm: serverTimestamp(),
      });
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
