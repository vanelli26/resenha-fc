import { Timestamp } from 'firebase/firestore';
import { Modalidade } from './modalidade.model';
import { PosicaoSociety, PosicoesAtleta } from './posicao.model';

export const STATUS_ATLETA = ['ativo', 'afastado', 'inativo'] as const;
export type StatusAtleta = (typeof STATUS_ATLETA)[number];

/** times/{timeId}/atletas/{atletaId} */
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
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}

/** Como está gravado: atletas anteriores às posições por esporte guardam uma lista (society). */
export type AtletaGravado = Omit<Atleta, 'posicoes'> & { posicoes: PosicaoSociety[] | PosicoesAtleta };
