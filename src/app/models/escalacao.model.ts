import { Timestamp } from 'firebase/firestore';
import { Esporte } from './posicao.model';

/**
 * Formações por esporte (DIRETRIZES 2.9): linhas de linha, da defesa ao ataque; o goleiro é implícito.
 * Lista fechada: alteração exige decisão. Primeira = padrão.
 */
export const FORMACOES_POR_ESPORTE: Record<Esporte, readonly string[]> = {
  futsal: ['2-2', '1-2-1', '3-1'],
  society: ['2-3-1', '3-2-1', '2-2-2'],
  campo: ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '5-3-2'],
};

/** Maior time em campo (campo: 11). */
export const MAX_TITULARES = 11;

/** Atleta numa vaga da formação (0 = goleiro; depois da defesa ao ataque, da esquerda para a direita). */
export interface Titular {
  atletaId: string;
  vaga: number;
}

/**
 * times/{timeId}/eventos/{eventoId}/escalacao/principal (diretoria monta; todos veem).
 * Reservas não são gravadas: quem vai (ou foi) e não está no campinho.
 */
export interface Escalacao {
  formacao: string;
  titulares: Titular[];
  atualizadoPor: string;
  atualizadoEm: Timestamp;
}
