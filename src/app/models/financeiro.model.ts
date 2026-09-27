import { Timestamp } from 'firebase/firestore';
import { Periodicidade } from './modalidade.model';

/** Tipo da cobrança = periodicidade do plano que a gerou. */
export type TipoCobranca = Periodicidade;

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
  /** Nome do plano na geração; vira a categoria da receita na baixa. Ausente em cobranças antigas. */
  planoNome?: string;
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
