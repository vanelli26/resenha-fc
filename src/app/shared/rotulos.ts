import { StatusAtleta, TipoVinculo } from '../models/atleta.model';
import { TipoCobranca } from '../models/financeiro.model';
import { Periodicidade } from '../models/modalidade.model';
import { PapelTime } from '../models/papel.model';
import { Esporte, Posicao } from '../models/posicao.model';
import { CorTime } from '../models/time.model';

// Textos de exibição dos enums do domínio (models só guardam os valores).
export const ROTULO_PAPEL: Record<PapelTime, string> = {
  diretoria: 'Diretoria',
  tesouraria: 'Tesouraria',
  jogador: 'Jogador',
};

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  mensal: 'Mensal',
  semestral: 'Semestral',
  avulso: 'Avulso (por jogo)',
};

export const ROTULO_POSICAO: Record<Posicao, string> = {
  goleiro: 'Goleiro',
  fixo: 'Fixo',
  ala_direita: 'Ala direita',
  ala_esquerda: 'Ala esquerda',
  meia: 'Meia',
  pivo: 'Pivô',
  zagueiro: 'Zagueiro',
  lateral_direito: 'Lateral direito',
  lateral_esquerdo: 'Lateral esquerdo',
  volante: 'Volante',
  meia_atacante: 'Meia-atacante',
  ponta_direita: 'Ponta direita',
  ponta_esquerda: 'Ponta esquerda',
  centroavante: 'Centroavante',
};

export const ROTULO_ESPORTE: Record<Esporte, string> = {
  campo: 'Campo',
  society: 'Society',
  futsal: 'Futsal',
};

export const ROTULO_VINCULO: Record<TipoVinculo, string> = {
  atleta: 'Atleta',
  socio: 'Sócio',
  colaborador: 'Colaborador / torcedor',
};

export const ROTULO_STATUS_ATLETA: Record<StatusAtleta, string> = {
  ativo: 'Ativo',
  afastado: 'Afastado',
  inativo: 'Inativo',
};

/** Nome de cobranças antigas (sem `planoNome`) e categoria da receita na baixa delas. */
export const ROTULO_TIPO_COBRANCA: Record<TipoCobranca, string> = {
  mensal: 'Mensalidade',
  semestral: 'Semestralidade',
  avulso: 'Avulso',
};

export const ROTULO_COR: Record<CorTime, string> = {
  preto: 'Preto e branco',
  red: 'Vermelho',
  rose: 'Rosa escuro',
  pink: 'Rosa',
  fuchsia: 'Fúcsia',
  purple: 'Roxo',
  violet: 'Violeta',
  indigo: 'Anil',
  blue: 'Azul',
  sky: 'Azul-celeste',
  cyan: 'Ciano',
  teal: 'Verde-azulado',
  emerald: 'Verde-esmeralda',
  green: 'Verde',
  lime: 'Verde-limão',
  yellow: 'Amarelo',
  amber: 'Amarelo-ouro',
  orange: 'Laranja',
};

export interface Opcao<T extends string> {
  label: string;
  value: T;
}

export function opcoes<T extends string>(valores: readonly T[], rotulos: Record<T, string>): Opcao<T>[] {
  return valores.map((value) => ({ value, label: rotulos[value] }));
}
