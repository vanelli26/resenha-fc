import { Timestamp } from 'firebase/firestore';
import { Modalidade } from './modalidade.model';
import { Posicao } from './posicao.model';

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
  posicoes: Posicao[];
  numeroCamisa?: number;
  status: StatusAtleta;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}
