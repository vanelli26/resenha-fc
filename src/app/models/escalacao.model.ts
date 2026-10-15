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

/** Formato antigo (até 30/09/2026): atleta numa vaga. Ainda lido; a diretoria regrava no formato novo. */
export interface Titular {
  atletaId: string;
  vaga: number;
}

/** Lado da escalação: primeiro time (e único, contra adversário) ou segundo time (jogo entre nós). */
export type LadoEscalacao = 'a' | 'b';

/** Dois times: nomes iniciais, editáveis pela diretoria (até 30 caracteres). */
export const NOMES_TIMES_PADRAO: readonly [string, string] = ['Time A', 'Time B'];
export const MAX_NOME_TIME_ESCALACAO = 30;

/**
 * times/{timeId}/eventos/{eventoId}/escalacao/principal. Diretoria monta e fecha; aberta, quem disse "Vou"
 * escolhe a própria vaga. Todos veem. Reservas não são gravadas: quem vai (ou foi) e não está no campinho.
 */
export interface Escalacao {
  formacao: string;
  /**
   * Chave da vaga → atletaId. Chave = número da vaga ("0" = goleiro; depois da defesa ao ataque, da esquerda para
   * a direita); no segundo time, com prefixo "b" ("b0").
   */
  vagas?: Record<string, string>;
  /** Dois times (jogo entre nós), mesma formação. Ausente = um time só. */
  nomes?: [string, string];
  /** Formato antigo, sem `vagas`. */
  titulares?: Titular[];
  /** Fechada: só a diretoria mexe. Ausente (formato antigo) = fechada. */
  fechada?: boolean;
  atualizadoPor: string;
  atualizadoEm: Timestamp;
}

export function chaveDaVaga(lado: LadoEscalacao, vaga: number): string {
  return lado === 'a' ? String(vaga) : `b${vaga}`;
}

/** "b3" → { lado: 'b', vaga: 3 }. */
export function vagaDaChave(chave: string): { lado: LadoEscalacao; vaga: number } {
  return chave.startsWith('b') ? { lado: 'b', vaga: Number(chave.slice(1)) } : { lado: 'a', vaga: Number(chave) };
}

/** Chave da vaga → atletaId, nos dois formatos. */
export function ocupacaoDaEscalacao(escalacao: Escalacao | null): Map<string, string> {
  if (!escalacao) return new Map();
  if (escalacao.vagas) return new Map(Object.entries(escalacao.vagas));
  return new Map((escalacao.titulares ?? []).map((t) => [String(t.vaga), t.atletaId]));
}

/** Vaga → atletaId de um lado. */
export function ocupacaoDoLado(ocupacao: ReadonlyMap<string, string>, lado: LadoEscalacao): Map<number, string> {
  const doLado = new Map<number, string>();
  for (const [chave, id] of ocupacao) {
    const v = vagaDaChave(chave);
    if (v.lado === lado) doLado.set(v.vaga, id);
  }
  return doLado;
}

/** Aberta para os jogadores escolherem a vaga (formato novo e não fechada). */
export function escalacaoAberta(escalacao: Escalacao | null): boolean {
  return !escalacao || (!!escalacao.vagas && escalacao.fechada === false);
}
