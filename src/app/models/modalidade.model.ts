/** Periodicidade de um plano de cobrança (DIRETRIZES 2.4). Também é o `tipo` da cobrança. */
export const PERIODICIDADES = ['mensal', 'semestral', 'avulso'] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

/** Modalidade sem cobrança (ex.: goleiros). Sempre disponível, não é um plano. */
export const ISENTO = 'isento';

/**
 * Modalidade de cobrança do atleta (`atletas.modalidade`): id de um plano do time
 * (`financeiro.planos`) ou `isento`. Planos migrados do formato antigo usam os ids
 * `mensal`, `semestral` e `avulso`, então cadastros antigos seguem válidos.
 */
export type Modalidade = string;
