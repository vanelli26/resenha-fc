import { Timestamp } from 'firebase/firestore';

// Cor predominante do time: nome de uma paleta do PrimeUIX, ou 'preto' (preto e branco).
// A paleta completa é montada no código (core/theme); o time guarda só o nome (DIRETRIZES 6.1).
export const CORES_TIME = [
  'preto',
  'red',
  'rose',
  'pink',
  'fuchsia',
  'purple',
  'violet',
  'indigo',
  'blue',
  'sky',
  'cyan',
  'teal',
  'emerald',
  'green',
  'lime',
  'yellow',
  'amber',
  'orange',
] as const;
export type CorTime = (typeof CORES_TIME)[number];

/** Escudo enviado pelo usuário: data URL de imagem já redimensionada (sem Storage no plano Spark). */
export const TAMANHO_MAX_ESCUDO = 120_000;

export interface ConfigMensal {
  ativo: boolean;
  valorCentavos: number;
  diaVencimento: number;
}

export interface ConfigSemestral {
  ativo: boolean;
  valorCentavos: number;
  diaVencimento: number;
  mesVencimentoS1: number;
  mesVencimentoS2: number;
}

export interface ConfigAvulso {
  ativo: boolean;
  valorCentavos: number;
}

export interface DespesaRecorrente {
  id: string;
  descricao: string;
  categoria: string;
  valorCentavos: number;
  diaVencimento: number;
}

export interface ConfigFinanceira {
  mensal: ConfigMensal;
  semestral: ConfigSemestral;
  avulso: ConfigAvulso;
  despesasRecorrentes: DespesaRecorrente[];
}

/** times/{timeId} */
export interface Time {
  nome: string;
  slug: string;
  cor: CorTime;
  /** data URL (image/webp ou png, até TAMANHO_MAX_ESCUDO caracteres) ou null. */
  escudo: string | null;
  criadoEm: Timestamp;
  financeiro: ConfigFinanceira;
}
