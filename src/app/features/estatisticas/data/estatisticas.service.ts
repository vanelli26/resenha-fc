import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { AjusteEstatistica, NumerosAtleta, idAjusteEstatistica } from '../../../models/estatistica.model';
import { Evento } from '../../../models/evento.model';
import { EventosService } from '../../agenda/data/eventos.service';

export interface Automatico {
  /** Números por atletaId, somados dos gols dos eventos (gol contra fica fora). */
  porAtleta: Map<string, NumerosAtleta>;
  jogos: number;
  golsPro: number;
}

/**
 * Artilharia e assistências (DIRETRIZES 2.10): automático a partir de `eventos/{id}/gols` + ajustes manuais
 * da diretoria em `times/{timeId}/ajustesEstatistica`.
 */
@Injectable({ providedIn: 'root' })
export class EstatisticasService {
  private readonly firestore = inject(FIRESTORE);
  private readonly eventos = inject(EventosService);

  /** Ano (ou outro intervalo): uma consulta dos eventos realizados + uma leitura dos gols de cada um. */
  async automaticoDoPeriodo(timeId: string, inicio: Date, fim: Date): Promise<Automatico> {
    return this.automaticoDosEventos(timeId, await this.eventos.listarRealizadosEntre(timeId, inicio, fim));
  }

  /** Soma os gols dos eventos informados (só os realizados contam). Uma leitura de gols por evento. */
  async automaticoDosEventos(timeId: string, eventos: ComId<Evento>[]): Promise<Automatico> {
    const realizados = eventos.filter((e) => e.status === 'realizado');
    const golsPorEvento = await Promise.all(realizados.map((e) => this.eventos.listarGols(timeId, e.id)));
    const porAtleta = new Map<string, NumerosAtleta>();
    const somar = (atletaId: string, campo: keyof NumerosAtleta) => {
      const atual = porAtleta.get(atletaId) ?? { gols: 0, assistencias: 0 };
      porAtleta.set(atletaId, { ...atual, [campo]: atual[campo] + 1 });
    };
    let golsPro = 0;
    for (const gol of golsPorEvento.flat()) {
      golsPro++;
      if (!gol.autorId) continue;
      somar(gol.autorId, 'gols');
      if (gol.assistenciaId) somar(gol.assistenciaId, 'assistencias');
    }
    return { porAtleta, jogos: realizados.length, golsPro };
  }

  private async listarAjustes(timeId: string, escopo: string): Promise<ComId<AjusteEstatistica>[]> {
    const snap = await getDocs(query(this.colecao(timeId), where('escopo', '==', escopo)));
    return snap.docs.map(comId);
  }

  /** Ajustes do escopo por atletaId. */
  async ajustesPorAtleta(timeId: string, escopo: string): Promise<Map<string, NumerosAtleta>> {
    const lista = await this.listarAjustes(timeId, escopo);
    return new Map(lista.map((a) => [a.atletaId, { gols: a.gols, assistencias: a.assistencias }]));
  }

  /**
   * Grava o total digitado pela diretoria como diferença sobre o automático (ajuste = total − automático).
   * Total igual ao automático grava zero (volta ao automático).
   */
  async salvarTotais(
    timeId: string,
    escopo: string,
    atletaId: string,
    totais: NumerosAtleta,
    automatico: NumerosAtleta | undefined,
    uid: string,
  ): Promise<void> {
    await setDoc(doc(this.colecao(timeId), idAjusteEstatistica(escopo, atletaId)), {
      atletaId,
      escopo,
      gols: totais.gols - (automatico?.gols ?? 0),
      assistencias: totais.assistencias - (automatico?.assistencias ?? 0),
      atualizadoPor: uid,
      atualizadoEm: serverTimestamp(),
    });
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'ajustesEstatistica').withConverter(
      conversor<AjusteEstatistica>(),
    );
  }
}
