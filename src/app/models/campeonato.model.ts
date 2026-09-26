/** times/{timeId}/campeonatos/{campeonatoId} */
export interface Campeonato {
  nome: string;
  temporada: string;
  // Valores de status ainda não definidos em DIRETRIZES (definir na Fase 4).
  status: string;
}

/** times/{timeId}/campeonatos/{campeonatoId}/estatisticas/{atletaId} */
export interface EstatisticaAtleta {
  gols: number;
  assistencias: number;
  amarelos: number;
  vermelhos: number;
}
