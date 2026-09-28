import { Injectable, inject } from '@angular/core';
import { collection, deleteField, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { STORAGE } from '../../../core/firebase/storage.token';
import { FotoProcessada } from '../../../shared/imagem';
import { EscolhaEscudo } from '../../../shared/seletor-escudo';
import { Esporte } from '../../../models/posicao.model';
import { ConfigFinanceira, CorTime, TimeGravado, VENCIMENTOS_PADRAO } from '../../../models/time.model';

export interface IdentidadeTime {
  nome: string;
  cor: CorTime;
  /** URL do Storage (ou data URL antigo) ou null. */
  escudo: string | null;
}

// Configuração financeira nasce sem planos; a tesouraria define depois (Rules exigem este padrão).
export const FINANCEIRO_PADRAO: ConfigFinanceira = {
  planos: [],
  vencimentos: VENCIMENTOS_PADRAO,
  despesasRecorrentes: [],
};

/** Times: lista (adminGeral, só leitura); identidade, escudo e esportes pela diretoria do time. */
@Injectable({ providedIn: 'root' })
export class TimesService {
  private readonly firestore = inject(FIRESTORE);
  private readonly storage = inject(STORAGE);

  /**
   * Envia o escudo ao Storage (diretoria) e devolve a URL de download. Nome com data/hora: cada troca
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

  /**
   * Grava o time com o escudo escolhido: imagem nova vai antes ao Storage (se gravar falhar, é apagada);
   * depois de gravar, o escudo anterior é apagado se mudou. Devolve o escudo final.
   */
  async gravarComEscudo(
    timeId: string,
    original: string | null,
    escolha: EscolhaEscudo,
    gravar: (escudo: string | null) => Promise<void>,
  ): Promise<string | null> {
    const enviado = escolha.tipo === 'novo' ? await this.enviarEscudo(timeId, escolha.foto) : null;
    const escudo = escolha.tipo === 'novo' ? enviado : escolha.tipo === 'remover' ? null : original;
    try {
      await gravar(escudo);
    } catch (e) {
      await this.apagarEscudo(enviado);
      throw e;
    }
    if (original !== escudo) await this.apagarEscudo(original);
    return escudo;
  }

  /** Diretoria: nome, cor e escudo do próprio time. */
  async salvarIdentidade(timeId: string, dados: IdentidadeTime): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId), { ...dados, tema: deleteField() });
  }

  async listar(): Promise<ComId<TimeGravado>[]> {
    const snap = await getDocs(
      query(collection(this.firestore, 'times').withConverter(conversor<TimeGravado>()), orderBy('nome')),
    );
    return snap.docs.map(comId);
  }

  /** Diretoria: só os esportes do time. */
  async salvarEsportes(timeId: string, esportes: Esporte[]): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId), { esportes });
  }
}
