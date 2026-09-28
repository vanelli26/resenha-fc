import { Injectable, inject } from '@angular/core';
import { collection, deleteField, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { STORAGE } from '../../../core/firebase/storage.token';
import { FotoProcessada } from '../../../shared/imagem';
import { Esporte } from '../../../models/posicao.model';
import { ConfigFinanceira, CorTime, TimeGravado, VENCIMENTOS_PADRAO } from '../../../models/time.model';

export interface DadosTime {
  nome: string;
  cor: CorTime;
  /** URL do Storage (ou data URL antigo) ou null. */
  escudo: string | null;
  esportes: Esporte[];
}

// Configuração financeira nasce sem planos; a tesouraria define depois (Rules exigem este padrão).
export const FINANCEIRO_PADRAO: ConfigFinanceira = {
  planos: [],
  vencimentos: VENCIMENTOS_PADRAO,
  despesasRecorrentes: [],
};

/** Cadastro de times (adminGeral). Esportes: também a diretoria do time. */
@Injectable({ providedIn: 'root' })
export class TimesService {
  private readonly firestore = inject(FIRESTORE);
  private readonly storage = inject(STORAGE);

  /**
   * Envia o escudo ao Storage (adminGeral) e devolve a URL de download. Nome com data/hora: cada troca
   * gera uma URL nova (o navegador não mostra a imagem antiga do cache).
   */
  async enviarEscudo(timeId: string, foto: FotoProcessada): Promise<string> {
    const extensao = foto.tipo === 'image/webp' ? 'webp' : foto.tipo === 'image/png' ? 'png' : 'jpeg';
    const arquivo = ref(this.storage, `times/${timeId}/escudo/${Date.now()}.${extensao}`);
    await uploadBytes(arquivo, foto.blob, { contentType: foto.tipo, cacheControl: 'public, max-age=31536000' });
    return getDownloadURL(arquivo);
  }

  /** Apaga um escudo antigo do Storage (data URL antigo não tem arquivo). Falha não impede salvar. */
  async apagarEscudo(escudo: string | null): Promise<void> {
    if (!escudo || !escudo.startsWith('https://')) return;
    await deleteObject(ref(this.storage, escudo)).catch(() => undefined);
  }

  async listar(): Promise<ComId<TimeGravado>[]> {
    const snap = await getDocs(
      query(collection(this.firestore, 'times').withConverter(conversor<TimeGravado>()), orderBy('nome')),
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
