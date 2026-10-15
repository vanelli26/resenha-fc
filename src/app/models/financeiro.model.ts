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

/**
 * Forma do pagamento, deduzida do texto da observação da baixa (não é gravada; DIRETRIZES 2.5). "campo" = pago
 * direto no campo (descontado do aluguel), tem prioridade sobre as demais.
 */
export const FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'cartao', 'campo', 'outro', 'nao_informada'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

/** Formas com botão na baixa: o toque escreve o rótulo na observação. */
export const FORMAS_DA_BAIXA: readonly FormaPagamento[] = ['pix', 'dinheiro', 'cartao', 'campo'];

export function formaDaObservacao(observacao: string | undefined): FormaPagamento {
  const texto = (observacao ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (!texto.trim()) return 'nao_informada';
  if (/campo|campinho/.test(texto)) return 'campo';
  if (/pix/.test(texto)) return 'pix';
  if (/dinheiro|especie/.test(texto)) return 'dinheiro';
  if (/cartao|debito|credito/.test(texto)) return 'cartao';
  return 'outro';
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
