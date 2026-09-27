import { Timestamp } from 'firebase/firestore';
import { Modalidade } from './modalidade.model';
import { PosicaoSociety, PosicoesAtleta } from './posicao.model';

export const STATUS_ATLETA = ['ativo', 'afastado', 'inativo'] as const;
export type StatusAtleta = (typeof STATUS_ATLETA)[number];

/** Relação da pessoa com o time. Só `atleta` aparece no Elenco; sócio e colaborador ficam em Gestão. */
export const VINCULOS = ['atleta', 'socio', 'colaborador'] as const;
export type TipoVinculo = (typeof VINCULOS)[number];

/** times/{timeId}/atletas/{atletaId} — toda pessoa cadastrada no time, jogando ou não. */
export interface Atleta {
  nome: string;
  apelido: string;
  telefone?: string;
  fotoUrl?: string;
  /** Conta vinculada; null quando a pessoa não tem conta no app. */
  uid: string | null;
  modalidade: Modalidade;
  posicoes: PosicoesAtleta;
  numeroCamisa?: number;
  status: StatusAtleta;
  /** Ausente em cadastros antigos = atleta. */
  vinculo?: TipoVinculo;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}

/** Como está gravado: atletas anteriores às posições por esporte guardam uma lista (society). */
export type AtletaGravado = Omit<Atleta, 'posicoes'> & { posicoes: PosicaoSociety[] | PosicoesAtleta };

export function vinculoDe(atleta: Pick<Atleta, 'vinculo'>): TipoVinculo {
  return atleta.vinculo ?? 'atleta';
}
