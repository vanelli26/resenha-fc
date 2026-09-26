export const MODALIDADES = ['mensal', 'semestral', 'avulso', 'isento'] as const;
export type Modalidade = (typeof MODALIDADES)[number];
