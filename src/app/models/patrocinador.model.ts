import { Timestamp } from 'firebase/firestore';

/** Logo reduzido no navegador e gravado no documento, como o escudo (sem Storage). */
export const TAMANHO_MAX_LOGO = 80_000;

/** Limite por time (faixa do mural; uma leitura só). */
export const MAX_PATROCINADORES = 20;

/** times/{timeId}/patrocinadores/{id} — apoiadores exibidos na faixa do mural (DIRETRIZES 2.8). */
export interface Patrocinador {
  nome: string;
  /** data URL (webp/png) ou null (mostra a inicial). */
  logo: string | null;
  /** https (site, Instagram, wa.me). Ausente = logo sem link. */
  link?: string;
  /** Posição na faixa (menor primeiro). */
  ordem: number;
  criadoEm: Timestamp;
}
