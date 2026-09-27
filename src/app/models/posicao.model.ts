// Esportes que um time pode praticar (DIRETRIZES 2.1). Ordem = ordem de exibição.
export const ESPORTES = ['campo', 'society', 'futsal'] as const;
export type Esporte = (typeof ESPORTES)[number];

/** Time sem o campo `esportes` (criado antes dele) pratica só society. */
export const ESPORTES_PADRAO: readonly Esporte[] = ['society'];

// Listas fechadas por esporte (DIRETRIZES 3.1). Alteração exige decisão.
export const POSICOES_SOCIETY = ['goleiro', 'fixo', 'ala_direita', 'ala_esquerda', 'meia', 'pivo'] as const;
export const POSICOES_CAMPO = [
  'goleiro',
  'zagueiro',
  'lateral_direito',
  'lateral_esquerdo',
  'volante',
  'meia',
  'meia_atacante',
  'ponta_direita',
  'ponta_esquerda',
  'centroavante',
] as const;
export const POSICOES_FUTSAL = ['goleiro', 'fixo', 'ala_direita', 'ala_esquerda', 'pivo'] as const;

export type PosicaoSociety = (typeof POSICOES_SOCIETY)[number];
export type PosicaoCampo = (typeof POSICOES_CAMPO)[number];
export type PosicaoFutsal = (typeof POSICOES_FUTSAL)[number];
export type Posicao = PosicaoSociety | PosicaoCampo | PosicaoFutsal;

/** Posições do atleta em cada esporte; esporte sem posição fica ausente. */
export interface PosicoesAtleta {
  campo?: PosicaoCampo[];
  society?: PosicaoSociety[];
  futsal?: PosicaoFutsal[];
}

export const POSICOES_POR_ESPORTE: { [E in Esporte]: readonly NonNullable<PosicoesAtleta[E]>[number][] } = {
  campo: POSICOES_CAMPO,
  society: POSICOES_SOCIETY,
  futsal: POSICOES_FUTSAL,
};

/** Formato antigo (lista simples, só society) → formato por esporte. */
export function normalizarPosicoes(posicoes: PosicaoSociety[] | PosicoesAtleta): PosicoesAtleta {
  if (!Array.isArray(posicoes)) return posicoes;
  return posicoes.length > 0 ? { society: posicoes } : {};
}

/** Esportes em que o atleta tem ao menos uma posição. */
export function esportesComPosicao(posicoes: PosicoesAtleta): Esporte[] {
  return ESPORTES.filter((e) => (posicoes[e]?.length ?? 0) > 0);
}
