export const PAPEIS_TIME = ['diretoria', 'tesouraria', 'jogador'] as const;
export type PapelTime = (typeof PAPEIS_TIME)[number];
