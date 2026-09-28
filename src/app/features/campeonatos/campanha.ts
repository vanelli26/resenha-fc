import { Evento } from '../../models/evento.model';

export interface Campanha {
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  /** Realizados sem placar informado (não entram em V/E/D nem nos gols). */
  semPlacar: number;
}

/** Campanha a partir do placar dos jogos realizados. */
export function campanhaDe(eventos: Evento[]): Campanha {
  const c: Campanha = { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, semPlacar: 0 };
  for (const e of eventos) {
    if (e.status !== 'realizado') continue;
    c.jogos++;
    if (e.placarPro === undefined || e.placarContra === undefined) {
      c.semPlacar++;
      continue;
    }
    c.golsPro += e.placarPro;
    c.golsContra += e.placarContra;
    if (e.placarPro > e.placarContra) c.vitorias++;
    else if (e.placarPro < e.placarContra) c.derrotas++;
    else c.empates++;
  }
  return c;
}
