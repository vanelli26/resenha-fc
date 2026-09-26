// Lista fechada (DIRETRIZES 3.1). Alteração exige decisão.
export const POSICOES = ['goleiro', 'fixo', 'ala_direita', 'ala_esquerda', 'meia', 'pivo'] as const;
export type Posicao = (typeof POSICOES)[number];
