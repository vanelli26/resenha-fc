import { Timestamp } from 'firebase/firestore';

export const STATUS_CAMPEONATO = ['andamento', 'encerrado'] as const;
export type StatusCampeonato = (typeof STATUS_CAMPEONATO)[number];

/** times/{timeId}/campeonatos/{id}. Partidas são eventos do tipo `campeonato` com `campeonatoId`. Não é excluído. */
export interface Campeonato {
  nome: string;
  /** Texto livre: "2026", "2026/2". */
  temporada: string;
  status: StatusCampeonato;
  criadoEm: Timestamp;
}

/** Teto da listagem (um time tem poucos campeonatos por ano). */
export const MAX_CAMPEONATOS_LISTADOS = 50;
