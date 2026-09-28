import { Timestamp } from 'firebase/firestore';

/** Maior total (e maior ajuste, em módulo) aceito por atleta num escopo. Rules conferem. */
export const MAX_ESTATISTICA = 999;

/**
 * Correção manual da diretoria sobre os números automáticos (gols dos eventos), DIRETRIZES 2.10.
 * Guarda só a diferença: exibido = automático + ajuste. `escopo` = ano (`AAAA`).
 * ID: `{escopo}_{atletaId}`.
 */
export interface AjusteEstatistica {
  atletaId: string;
  escopo: string;
  gols: number;
  assistencias: number;
  atualizadoPor: string;
  atualizadoEm: Timestamp;
}

export interface NumerosAtleta {
  gols: number;
  assistencias: number;
}

export function idAjusteEstatistica(escopo: string, atletaId: string): string {
  return `${escopo}_${atletaId}`;
}
