import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { AjusteEstatistica, NumerosAtleta, idAjusteEstatistica } from '../../../models/estatistica.model';
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

  /** Uma consulta dos eventos realizados no intervalo + uma leitura dos gols de cada um. */
  async automatico(timeId: string, inicio: Date, fim: Date): Promise<Automatico> {
    const realizados = await this.eventos.listarRealizadosEntre(timeId, inicio, fim);
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

  async listarAjustes(timeId: string, escopo: string): Promise<ComId<AjusteEstatistica>[]> {
    const snap = await getDocs(query(this.colecao(timeId), where('escopo', '==', escopo)));
    return snap.docs.map(comId);
  }

  /** Grava a diferença (ajuste = total desejado − automático). Zero volta ao automático. */
  async salvarAjuste(timeId: string, escopo: string, atletaId: string, ajuste: NumerosAtleta, uid: string): Promise<void> {
    await setDoc(doc(this.colecao(timeId), idAjusteEstatistica(escopo, atletaId)), {
      atletaId,
      escopo,
      gols: ajuste.gols,
      assistencias: ajuste.assistencias,
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
