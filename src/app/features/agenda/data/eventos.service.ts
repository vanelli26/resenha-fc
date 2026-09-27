import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Atleta, vinculoDe } from '../../../models/atleta.model';
import { Evento, Presenca, RespostaPresenca, TIPOS_EVENTO_ABERTOS, TipoEvento } from '../../../models/evento.model';
import { Esporte } from '../../../models/posicao.model';

const MAX_PROXIMOS = 30;
export const TAMANHO_PAGINA_ANTERIORES = 20;

/** Campos editáveis de um evento. `adversario` vazio é removido. */
export interface DadosEvento {
  tipo: TipoEvento;
  titulo: string;
  data: Date;
  local: string;
  esporte: Esporte;
  adversario?: string;
}

export interface Placar {
  pro: number;
  contra: number;
}

/** Presença efetiva no encerramento. `temPresenca`: já existe documento (respondeu ou marcado antes). */
export interface Comparecimento {
  atletaId: string;
  compareceu: boolean;
  temPresenca: boolean;
}

/** Quem participa de um tipo de evento: cadastro ativo; nos esportivos, só atletas (DIRETRIZES 2.7). */
export function participa(tipo: TipoEvento, atleta: Pick<Atleta, 'status' | 'vinculo'>): boolean {
  return atleta.status === 'ativo' && (TIPOS_EVENTO_ABERTOS.includes(tipo) || vinculoDe(atleta) === 'atleta');
}

/** Quem pode responder presença agora (mesma regra das Rules): participa e o evento está agendado. */
export function podeResponder(evento: Pick<Evento, 'tipo' | 'status'>, atleta: Pick<Atleta, 'status' | 'vinculo'>): boolean {
  return evento.status === 'agendado' && participa(evento.tipo, atleta);
}

/** times/{timeId}/eventos e presencas. Leitura: todos do time. Eventos: diretoria. Presença: cada um a sua. */
@Injectable({ providedIn: 'root' })
export class EventosService {
  private readonly firestore = inject(FIRESTORE);

  /** Próximos (inclui cancelados, para quem ainda não viu o aviso), mais cedo primeiro. */
  async listarProximos(timeId: string, agora: Date): Promise<ComId<Evento>[]> {
    const snap = await getDocs(
      query(this.colecao(timeId), where('data', '>=', Timestamp.fromDate(agora)), orderBy('data'), limit(MAX_PROXIMOS)),
    );
    return snap.docs.map(comId);
  }

  /** Anteriores, mais recentes primeiro, em páginas; `depoisDe` é o último da página anterior. */
  async listarAnteriores(timeId: string, agora: Date, depoisDe?: Timestamp): Promise<ComId<Evento>[]> {
    const filtros = [where('data', '<', Timestamp.fromDate(agora)), orderBy('data', 'desc')];
    const snap = await getDocs(
      depoisDe
        ? query(this.colecao(timeId), ...filtros, startAfter(depoisDe), limit(TAMANHO_PAGINA_ANTERIORES))
        : query(this.colecao(timeId), ...filtros, limit(TAMANHO_PAGINA_ANTERIORES)),
    );
    return snap.docs.map(comId);
  }

  /** Próximo evento agendado (Meus times). Índice composto status + data. */
  async proximoAgendado(timeId: string, agora: Date): Promise<ComId<Evento> | null> {
    const snap = await getDocs(
      query(
        this.colecao(timeId),
        where('status', '==', 'agendado'),
        where('data', '>=', Timestamp.fromDate(agora)),
        orderBy('data'),
        limit(1),
      ),
    );
    return snap.docs[0] ? comId(snap.docs[0]) : null;
  }

  /** Últimos eventos encerrados, mais recentes primeiro (cobrança de avulsos). Índice status + data desc. */
  async listarRealizados(timeId: string, quantidade = 10): Promise<ComId<Evento>[]> {
    const snap = await getDocs(
      query(this.colecao(timeId), where('status', '==', 'realizado'), orderBy('data', 'desc'), limit(quantidade)),
    );
    return snap.docs.map(comId);
  }

  async obter(timeId: string, eventoId: string): Promise<ComId<Evento> | null> {
    const snap = await getDoc(doc(this.colecao(timeId), eventoId));
    const dados = snap.data();
    return dados ? { ...dados, id: snap.id } : null;
  }

  /** Cria um ou vários (repetição semanal) no mesmo lote. */
  async criar(timeId: string, eventos: DadosEvento[], uid: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    for (const e of eventos) {
      batch.set(doc(collection(this.firestore, 'times', timeId, 'eventos')), {
        ...this.campos(e),
        ...(e.adversario ? { adversario: e.adversario } : {}),
        status: 'agendado',
        criadoPor: uid,
        criadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  async atualizar(timeId: string, eventoId: string, e: DadosEvento): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId, 'eventos', eventoId), {
      ...this.campos(e),
      adversario: e.adversario || deleteField(),
    });
  }

  /** Cancelar ou reativar (agendado ↔ cancelado). */
  async definirCancelado(timeId: string, eventoId: string, cancelado: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId, 'eventos', eventoId), {
      status: cancelado ? 'cancelado' : 'agendado',
    });
  }

  /**
   * Encerrar (ou corrigir o encerramento): status `realizado`, placar e `compareceu`, num lote só.
   * Quem não tem presença só ganha documento se compareceu (evita escrever faltas de quem nem respondeu).
   */
  async encerrar(timeId: string, eventoId: string, placar: Placar | null, lista: Comparecimento[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, 'times', timeId, 'eventos', eventoId), {
      status: 'realizado',
      placarPro: placar ? placar.pro : deleteField(),
      placarContra: placar ? placar.contra : deleteField(),
    });
    for (const c of lista) {
      if (!c.temPresenca && !c.compareceu) continue;
      batch.set(
        doc(this.presencas(timeId, eventoId), c.atletaId),
        { compareceu: c.compareceu, atualizadoEm: serverTimestamp() },
        { merge: true },
      );
    }
    await batch.commit();
  }

  /** Minhas respostas nos eventos informados (uma leitura por evento). */
  async minhasRespostas(
    timeId: string,
    eventoIds: string[],
    atletaId: string,
  ): Promise<Map<string, RespostaPresenca>> {
    const pares = await Promise.all(
      eventoIds.map(async (id): Promise<[string, RespostaPresenca | null]> => {
        const snap = await getDoc(doc(this.presencas(timeId, id), atletaId));
        return [id, snap.data()?.resposta ?? null];
      }),
    );
    const respostas = new Map<string, RespostaPresenca>();
    for (const [id, r] of pares) if (r) respostas.set(id, r);
    return respostas;
  }

  async responder(timeId: string, eventoId: string, atletaId: string, resposta: RespostaPresenca): Promise<void> {
    // merge: preserva `compareceu` quando a diretoria já marcou (3b).
    await setDoc(
      doc(this.presencas(timeId, eventoId), atletaId),
      { resposta, atualizadoEm: serverTimestamp() },
      { merge: true },
    );
  }

  /** Presenças do evento em tempo real (DIRETRIZES 7). Retorna a função que encerra o listener. */
  ouvirPresencas(
    timeId: string,
    eventoId: string,
    aoMudar: (presencas: ComId<Presenca>[]) => void,
    aoFalhar: (erro: Error) => void,
  ): () => void {
    return onSnapshot(
      this.presencas(timeId, eventoId),
      (snap) => aoMudar(snap.docs.map(comId)),
      aoFalhar,
    );
  }

  private campos(e: DadosEvento) {
    return {
      tipo: e.tipo,
      titulo: e.titulo,
      data: Timestamp.fromDate(e.data),
      local: e.local,
      esporte: e.esporte,
    };
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'eventos').withConverter(conversor<Evento>());
  }

  private presencas(timeId: string, eventoId: string) {
    return collection(this.firestore, 'times', timeId, 'eventos', eventoId, 'presencas').withConverter(
      conversor<Presenca>(),
    );
  }
}
