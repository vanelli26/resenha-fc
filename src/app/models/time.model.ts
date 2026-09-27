import { Timestamp } from 'firebase/firestore';
import { PERIODICIDADES, Periodicidade } from './modalidade.model';
import { Esporte } from './posicao.model';

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

export interface PlanoCobranca {
  /** `mensal`/`semestral`/`avulso` nos planos migrados; aleatório [a-z0-9] nos novos. */
  id: string;
  /** Até 40 caracteres (vira categoria do caixa). Ex.: "Sócio semestral". */
  nome: string;
  periodicidade: Periodicidade;
  valorCentavos: number;
}

/** Regras de vencimento, únicas por periodicidade. */
export interface Vencimentos {
  diaMensal: number;
  diaSemestral: number;
  /** Mês de vencimento do 1º semestre (1..6) e do 2º (7..12). */
  mesS1: number;
  mesS2: number;
}

// Formato antigo (valores fixos por modalidade). Lido e convertido em planos ao carregar o time;
// a primeira gravação da configuração já sai no formato novo.
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

export interface ConfigFinanceiraLegada {
  mensal: ConfigMensal;
  semestral: ConfigSemestral;
  avulso: ConfigAvulso;
  despesasRecorrentes: DespesaRecorrente[];
}

export interface ConfigFinanceira {
  planos: PlanoCobranca[];
  vencimentos: Vencimentos;
  despesasRecorrentes: DespesaRecorrente[];
}

export const VENCIMENTOS_PADRAO: Vencimentos = { diaMensal: 10, diaSemestral: 10, mesS1: 1, mesS2: 7 };

const NOME_PLANO_LEGADO: Record<Periodicidade, string> = {
  mensal: 'Mensalidade',
  semestral: 'Semestralidade',
  avulso: 'Avulso',
};

/** Converte o formato antigo: cada modalidade ativa vira um plano com id = nome da modalidade. */
export function normalizarFinanceiro(f: ConfigFinanceira | ConfigFinanceiraLegada): ConfigFinanceira {
  if ('planos' in f) return f;
  const planos: PlanoCobranca[] = PERIODICIDADES.filter((p) => f[p].ativo).map((p) => ({
    id: p,
    nome: NOME_PLANO_LEGADO[p],
    periodicidade: p,
    valorCentavos: f[p].valorCentavos,
  }));
  return {
    planos,
    vencimentos: {
      diaMensal: f.mensal.diaVencimento,
      diaSemestral: f.semestral.diaVencimento,
      mesS1: f.semestral.mesVencimentoS1,
      mesS2: f.semestral.mesVencimentoS2,
    },
    despesasRecorrentes: f.despesasRecorrentes,
  };
}

/** times/{timeId} */
export interface Time {
  nome: string;
  slug: string;
  cor: CorTime;
  /** URL do Storage (times/{timeId}/escudo/…) ou null. Times antigos: data URL (até 120 000 caracteres). */
  escudo: string | null;
  criadoEm: Timestamp;
  /** Sempre no formato de planos (normalizado ao carregar; ver `TimeGravado`). */
  financeiro: ConfigFinanceira;
  /** Ausente em times antigos = só society (ESPORTES_PADRAO). */
  esportes?: Esporte[];
}

/** Como está gravado: times anteriores aos planos guardam o formato antigo. */
export type TimeGravado = Omit<Time, 'financeiro'> & { financeiro: ConfigFinanceira | ConfigFinanceiraLegada };
