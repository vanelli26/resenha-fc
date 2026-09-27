import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  deleteField,
  getCountFromServer,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Cobranca, TipoCobranca } from '../../../models/financeiro.model';
import { rotuloReferencia } from '../../../shared/competencia';
import { ROTULO_TIPO_COBRANCA } from '../../../shared/rotulos';

/** Limite de operações de um lote do Firestore (DIRETRIZES 5). */
const TAMANHO_LOTE = 500;
/** "Em aberto" é limitado por atletas × competências; o teto só protege contra dado inesperado. */
const MAX_EM_ABERTO = 500;
/** Histórico do jogador: ~4 anos de mensalidades. */
const MAX_DO_ATLETA = 60;

export interface NovaCobranca {
  atletaId: string;
  atletaNome: string;
  tipo: TipoCobranca;
  referencia: string;
  valorCentavos: number;
  vencimento: Date;
  planoNome: string;
}

/** Nome da cobrança: o plano da geração; cobranças antigas (sem plano) usam o tipo. */
export function nomeDaCobranca(c: Pick<Cobranca, 'planoNome' | 'tipo'>): string {
  return c.planoNome ?? ROTULO_TIPO_COBRANCA[c.tipo];
}

/** ID determinístico: gerar duas vezes não duplica (DIRETRIZES 2.5). */
export function idCobranca(atletaId: string, referencia: string): string {
  return `${atletaId}_${referencia}`;
}

/** Lançamento de receita criado pela baixa. */
function idLancamentoDaCobranca(cobrancaId: string): string {
  return `cob_${cobrancaId}`;
}

/**
 * times/{timeId}/cobrancas. Leitura: diretoria/tesouraria (todas) e jogador (só as dele, Fase 2c).
 * Escrita: tesouraria. Baixa/estorno mexem na cobrança e no caixa no mesmo lote (Rules conferem).
 */
@Injectable({ providedIn: 'root' })
export class CobrancasService {
  private readonly firestore = inject(FIRESTORE);

  async listarPorReferencia(timeId: string, referencia: string): Promise<ComId<Cobranca>[]> {
    const snap = await getDocs(query(this.colecao(timeId), where('referencia', '==', referencia)));
    return snap.docs.map(comId);
  }

  /** Cobranças com vencimento no intervalo [inicio, fim) — mensais e semestrais do mês juntas. */
  async listarPorVencimento(timeId: string, inicio: Date, fim: Date): Promise<ComId<Cobranca>[]> {
    const snap = await getDocs(
      query(
        this.colecao(timeId),
        where('vencimento', '>=', Timestamp.fromDate(inicio)),
        where('vencimento', '<', Timestamp.fromDate(fim)),
        orderBy('vencimento'),
      ),
    );
    return snap.docs.map(comId);
  }

  /**
   * Cobranças de um atleta (visão do jogador), mais recentes primeiro. O filtro por atletaId é o
   * mesmo que as Rules exigem para o jogador. Índice composto (atletaId, vencimento desc).
   */
  async listarDoAtleta(timeId: string, atletaId: string): Promise<ComId<Cobranca>[]> {
    const snap = await getDocs(
      query(this.colecao(timeId), where('atletaId', '==', atletaId), orderBy('vencimento', 'desc'), limit(MAX_DO_ATLETA)),
    );
    return snap.docs.map(comId);
  }

  /** Quantas cobranças pendentes o atleta tem (selo em "Meus times"). Contagem no servidor. */
  async contarPendentesDoAtleta(timeId: string, atletaId: string): Promise<number> {
    const snap = await getCountFromServer(
      query(this.colecao(timeId), where('atletaId', '==', atletaId), where('status', '==', 'pendente')),
    );
    return snap.data().count;
  }

  /** Pendentes de qualquer competência (inclui as atrasadas). */
  async listarEmAberto(timeId: string): Promise<ComId<Cobranca>[]> {
    const snap = await getDocs(query(this.colecao(timeId), where('status', '==', 'pendente'), limit(MAX_EM_ABERTO)));
    return snap.docs.map(comId);
  }

  /** Cria as cobranças em lotes. Quem chama já removeu as existentes; as Rules barram sobrescrita. */
  async gerar(timeId: string, cobrancas: NovaCobranca[]): Promise<void> {
    for (let i = 0; i < cobrancas.length; i += TAMANHO_LOTE) {
      const batch = writeBatch(this.firestore);
      for (const c of cobrancas.slice(i, i + TAMANHO_LOTE)) {
        batch.set(doc(this.colecao(timeId), idCobranca(c.atletaId, c.referencia)), {
          atletaId: c.atletaId,
          atletaNome: c.atletaNome,
          tipo: c.tipo,
          referencia: c.referencia,
          valorCentavos: c.valorCentavos,
          vencimento: Timestamp.fromDate(c.vencimento),
          planoNome: c.planoNome,
          status: 'pendente',
        });
      }
      await batch.commit();
    }
  }

  /** Marca como paga e cria a receita `cob_{id}` no caixa, no mesmo lote. */
  async darBaixa(
    timeId: string,
    cobranca: ComId<Cobranca>,
    dados: { pagoEm: Date; observacao: string; uid: string },
  ): Promise<void> {
    const pagoEm = Timestamp.fromDate(dados.pagoEm);
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.colecao(timeId), cobranca.id), {
      status: 'pago',
      pagoEm,
      baixadoPor: dados.uid,
      observacao: dados.observacao || deleteField(),
    });
    batch.set(doc(this.firestore, 'times', timeId, 'lancamentos', idLancamentoDaCobranca(cobranca.id)), {
      tipo: 'receita',
      // Categoria = nome do plano: o caixa separa por tipo de pagante (DIRETRIZES 2.6).
      categoria: nomeDaCobranca(cobranca),
      descricao: `${nomeDaCobranca(cobranca)} ${rotuloReferencia(cobranca.referencia)} · ${cobranca.atletaNome}`,
      valorCentavos: cobranca.valorCentavos,
      data: pagoEm,
      cobrancaId: cobranca.id,
      criadoPor: dados.uid,
      criadoEm: serverTimestamp(),
    });
    await batch.commit();
  }

  /** Volta para pendente e remove a receita da baixa, no mesmo lote. */
  async estornar(timeId: string, cobrancaId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.colecao(timeId), cobrancaId), {
      status: 'pendente',
      pagoEm: deleteField(),
      baixadoPor: deleteField(),
      observacao: deleteField(),
    });
    batch.delete(doc(this.firestore, 'times', timeId, 'lancamentos', idLancamentoDaCobranca(cobrancaId)));
    await batch.commit();
  }

  /** pendente → cancelado (ou de volta, com `reabrir`). Não mexe no caixa. */
  async definirCancelada(timeId: string, cobrancaId: string, cancelada: boolean): Promise<void> {
    await updateDoc(doc(this.colecao(timeId), cobrancaId), { status: cancelada ? 'cancelado' : 'pendente' });
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'cobrancas').withConverter(conversor<Cobranca>());
  }
}
