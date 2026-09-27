import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { STORAGE } from '../../../core/firebase/storage.token';
import { FotoPost, Recado } from '../../../models/recado.model';
import { FotoProcessada } from '../../../shared/imagem';

/** Feed carrega de 10 em 10 ("Ver mais" aumenta o limite do listener). */
export const TAMANHO_PAGINA_MURAL = 10;

export interface NovoPost {
  texto: string;
  fixado: boolean;
  fotos: FotoProcessada[];
}

export interface AutorPost {
  uid: string;
  nome: string;
  fotoUrl: string | null;
}

/** times/{timeId}/recados + fotos no Storage. Leitura: todos do time (tempo real). Publicar: qualquer membro. */
@Injectable({ providedIn: 'root' })
export class RecadosService {
  private readonly firestore = inject(FIRESTORE);
  private readonly storage = inject(STORAGE);

  /** Fixados primeiro, depois os mais novos. Índice composto fixado desc + criadoEm desc. */
  ouvir(
    timeId: string,
    quantidade: number,
    aoMudar: (recados: ComId<Recado>[]) => void,
    aoFalhar: (erro: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.colecao(timeId), orderBy('fixado', 'desc'), orderBy('criadoEm', 'desc'), limit(quantidade)),
      (snap) => aoMudar(snap.docs.map(comId)),
      aoFalhar,
    );
  }

  /**
   * Envia as fotos (id do post gerado antes, para o caminho) e grava o post.
   * Se o post falhar, apaga as fotos já enviadas.
   */
  async publicar(
    timeId: string,
    post: NovoPost,
    autor: AutorPost,
    aoProgredir?: (enviadas: number) => void,
  ): Promise<void> {
    const postRef = doc(collection(this.firestore, 'times', timeId, 'recados'));
    const fotos: FotoPost[] = [];
    try {
      for (const [i, foto] of post.fotos.entries()) {
        const caminho = `times/${timeId}/recados/${postRef.id}/${i}.${foto.tipo === 'image/webp' ? 'webp' : 'jpeg'}`;
        const arquivo = ref(this.storage, caminho);
        await uploadBytes(arquivo, foto.blob, { contentType: foto.tipo, customMetadata: { autorUid: autor.uid } });
        fotos.push({ url: await getDownloadURL(arquivo), caminho, largura: foto.largura, altura: foto.altura });
        aoProgredir?.(i + 1);
      }
      await setDoc(postRef, {
        texto: post.texto,
        ...(fotos.length > 0 ? { fotos } : {}),
        fixado: post.fixado,
        autorUid: autor.uid,
        autorNome: autor.nome,
        ...(autor.fotoUrl ? { autorFotoUrl: autor.fotoUrl } : {}),
        criadoEm: serverTimestamp(),
      });
    } catch (e) {
      await this.apagarFotos(fotos.map((f) => f.caminho));
      throw e;
    }
  }

  /** Autor: só a legenda. */
  async editarTexto(timeId: string, recadoId: string, texto: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId, 'recados', recadoId), { texto });
  }

  /** Diretoria: fixar ou soltar. */
  async fixar(timeId: string, recadoId: string, fixado: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'times', timeId, 'recados', recadoId), { fixado });
  }

  /** Apaga o post e depois as fotos (se as fotos falharem, o post já saiu do mural). */
  async excluir(timeId: string, recado: ComId<Recado>): Promise<void> {
    await deleteDoc(doc(this.firestore, 'times', timeId, 'recados', recado.id));
    await this.apagarFotos((recado.fotos ?? []).map((f) => f.caminho));
  }

  private async apagarFotos(caminhos: string[]): Promise<void> {
    await Promise.allSettled(caminhos.map((c) => deleteObject(ref(this.storage, c))));
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'recados').withConverter(conversor<Recado>());
  }
}
