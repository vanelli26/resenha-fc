import { StatusAtleta } from '../models/atleta.model';
import { Modalidade } from '../models/modalidade.model';
import { PapelTime } from '../models/papel.model';
import { Posicao } from '../models/posicao.model';
import { CorTime } from '../models/time.model';

// Textos de exibição dos enums do domínio (models só guardam os valores).
export const ROTULO_PAPEL: Record<PapelTime, string> = {
  diretoria: 'Diretoria',
  tesouraria: 'Tesouraria',
  jogador: 'Jogador',
};

export const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  mensal: 'Mensal',
  semestral: 'Semestral',
  avulso: 'Avulso',
  isento: 'Isento',
};

export const ROTULO_POSICAO: Record<Posicao, string> = {
  goleiro: 'Goleiro',
  fixo: 'Fixo',
  ala_direita: 'Ala direita',
  ala_esquerda: 'Ala esquerda',
  meia: 'Meia',
  pivo: 'Pivô',
};

export const ROTULO_STATUS_ATLETA: Record<StatusAtleta, string> = {
  ativo: 'Ativo',
  afastado: 'Afastado',
  inativo: 'Inativo',
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
