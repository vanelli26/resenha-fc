import { Timestamp } from 'firebase/firestore';
import { Modalidade } from './modalidade.model';

export type TipoCobranca = Exclude<Modalidade, 'isento'>;
export const TIPOS_COBRANCA: readonly TipoCobranca[] = ['mensal', 'semestral', 'avulso'];

/** Status gravado. "Atrasado" é derivado na UI (pendente e vencimento < hoje), nunca gravado. */
export const STATUS_COBRANCA = ['pendente', 'pago', 'cancelado'] as const;
export type StatusCobranca = (typeof STATUS_COBRANCA)[number];

/** times/{timeId}/cobrancas/{atletaId}_{referencia} */
export interface Cobranca {
  atletaId: string;
  atletaNome: string;
  tipo: TipoCobranca;
  /** AAAA-MM, AAAA-S1/AAAA-S2 ou eventoId (avulso). */
  referencia: string;
  valorCentavos: number;
  vencimento: Timestamp;
  status: StatusCobranca;
  pagoEm?: Timestamp;
  baixadoPor?: string;
  observacao?: string;
}

export const TIPOS_LANCAMENTO = ['receita', 'despesa'] as const;
export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

/** times/{timeId}/lancamentos/{id} */
export interface Lancamento {
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  valorCentavos: number;
  data: Timestamp;
  cobrancaId?: string;
  recorrenteId?: string;
  criadoPor: string;
  criadoEm: Timestamp;
}
