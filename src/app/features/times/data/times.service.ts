import { Injectable, inject } from '@angular/core';
import { collection, deleteField, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Esporte } from '../../../models/posicao.model';
import { ConfigFinanceira, CorTime, Time } from '../../../models/time.model';

export interface DadosTime {
  nome: string;
  cor: CorTime;
  escudo: string | null;
  esportes: Esporte[];
}

// Configuração financeira nasce desligada; é definida na Fase 2 (tesouraria).
const FINANCEIRO_PADRAO: ConfigFinanceira = {
  mensal: { ativo: false, valorCentavos: 0, diaVencimento: 10 },
  semestral: { ativo: false, valorCentavos: 0, diaVencimento: 10, mesVencimentoS1: 1, mesVencimentoS2: 7 },
  avulso: { ativo: false, valorCentavos: 0 },
  despesasRecorrentes: [],
};

/** Cadastro de times (adminGeral). Esportes: também a diretoria do time. */
@Injectable({ providedIn: 'root' })
export class TimesService {
  private readonly firestore = inject(FIRESTORE);

  async listar(): Promise<ComId<Time>[]> {
    const snap = await getDocs(
      query(collection(this.firestore, 'times').withConverter(conversor<Time>()), orderBy('nome')),
    );
    return snap.docs.map(comId);
  }

  /** timeId = slug. Falha se o slug já existir. */
  async criar(slug: string, dados: DadosTime): Promise<void> {
    const ref = doc(this.firestore, 'times', slug);
    if ((await getDoc(ref)).exists()) {
      throw new Error(`Já existe um time com o identificador "${slug}".`);
    }
    await setDoc(ref, { ...dados, slug, financeiro: FINANCEIRO_PADRAO, criadoEm: serverTimestamp() });
  }

  /** Diretoria (ou adminGeral): só os esportes do time. */
  async salvarEsportes(timeId: string, esportes: Esporte[]): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId), { esportes });
  }

  async atualizar(timeId: string, dados: DadosTime): Promise<void> {
    // `tema` é o campo antigo (paletas fixas); removido ao salvar com a cor nova.
    await updateDoc(doc(this.firestore, 'times', timeId), { ...dados, tema: deleteField() });
  }
}
