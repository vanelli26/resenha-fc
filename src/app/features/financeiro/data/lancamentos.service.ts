import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  sum,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Lancamento, TipoLancamento } from '../../../models/financeiro.model';
import { DespesaRecorrente } from '../../../models/time.model';

/** Um mês raramente passa de algumas dezenas; o teto só protege contra dado inesperado. */
export const MAX_POR_PERIODO = 500;

/** Campos editáveis de um lançamento manual (ou de uma recorrente já lançada). */
export interface DadosLancamento {
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  valorCentavos: number;
  data: Date;
}

/** Despesa recorrente do mês: ID idempotente (DIRETRIZES 2.6). `mes` em AAAA-MM. */
export function idLancamentoRecorrente(recorrenteId: string, mes: string): string {
  return `rec_${recorrenteId}_${mes}`;
}

/** Receitas criadas pela baixa de cobrança: só mudam pela cobrança (baixa/estorno). */
export function ehLancamentoDeBaixa(lancamentoId: string): boolean {
  return lancamentoId.startsWith('cob_');
}

/** times/{timeId}/lancamentos. Leitura: diretoria/tesouraria (jogador nunca). Escrita: tesouraria. */
@Injectable({ providedIn: 'root' })
export class LancamentosService {
  private readonly firestore = inject(FIRESTORE);

  /** Lançamentos com data em [inicio, fim), mais recentes primeiro (até MAX_POR_PERIODO). */
  async listarDoPeriodo(timeId: string, inicio: Date, fim: Date): Promise<ComId<Lancamento>[]> {
    const snap = await getDocs(
      query(
        this.colecao(timeId),
        where('data', '>=', Timestamp.fromDate(inicio)),
        where('data', '<', Timestamp.fromDate(fim)),
        orderBy('data', 'desc'),
        limit(MAX_POR_PERIODO),
      ),
    );
    return snap.docs.map(comId);
  }

  /**
   * Saldo = receitas − despesas, somados no servidor (sem documento de saldo, DIRETRIZES 2.6).
   * `sum` com filtro exige o índice composto (tipo, valorCentavos) em firestore.indexes.json.
   */
  async saldo(timeId: string): Promise<number> {
    const [receitas, despesas] = await Promise.all([this.somar(timeId, 'receita'), this.somar(timeId, 'despesa')]);
    return receitas - despesas;
  }

  /** Saldo de tudo lançado antes de `data` (saldo anterior do relatório). Índice (tipo, data, valorCentavos). */
  async saldoAntesDe(timeId: string, data: Date): Promise<number> {
    const [receitas, despesas] = await Promise.all([
      this.somar(timeId, 'receita', data),
      this.somar(timeId, 'despesa', data),
    ]);
    return receitas - despesas;
  }

  async criar(timeId: string, dados: DadosLancamento, uid: string): Promise<void> {
    await addDoc(this.colecao(timeId), {
      ...dados,
      data: Timestamp.fromDate(dados.data),
      criadoPor: uid,
      criadoEm: serverTimestamp(),
    });
  }

  /** Tipo não muda depois de criado (Rules); o formulário de edição não oferece a troca. */
  async atualizar(timeId: string, lancamentoId: string, dados: Omit<DadosLancamento, 'tipo'>): Promise<void> {
    await updateDoc(doc(this.colecao(timeId), lancamentoId), {
      categoria: dados.categoria,
      descricao: dados.descricao,
      valorCentavos: dados.valorCentavos,
      data: Timestamp.fromDate(dados.data),
    });
  }

  async excluir(timeId: string, lancamentoId: string): Promise<void> {
    await deleteDoc(doc(this.colecao(timeId), lancamentoId));
  }

  /** Lança a despesa recorrente no mês (vencimento no dia configurado). Quem chama confere se já existe. */
  async lancarRecorrente(timeId: string, despesa: DespesaRecorrente, mes: string, data: Date, uid: string): Promise<void> {
    await setDoc(doc(this.colecao(timeId), idLancamentoRecorrente(despesa.id, mes)), {
      tipo: 'despesa',
      categoria: despesa.categoria,
      descricao: despesa.descricao,
      valorCentavos: despesa.valorCentavos,
      data: Timestamp.fromDate(data),
      recorrenteId: despesa.id,
      criadoPor: uid,
      criadoEm: serverTimestamp(),
    });
  }

  private async somar(timeId: string, tipo: TipoLancamento, antesDe?: Date): Promise<number> {
    const filtros = [where('tipo', '==', tipo), ...(antesDe ? [where('data', '<', Timestamp.fromDate(antesDe))] : [])];
    const snap = await getAggregateFromServer(query(this.colecao(timeId), ...filtros), { total: sum('valorCentavos') });
    return snap.data().total ?? 0;
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'lancamentos').withConverter(conversor<Lancamento>());
  }
}
