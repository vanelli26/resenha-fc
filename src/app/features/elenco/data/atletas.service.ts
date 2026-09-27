import { Injectable, inject } from '@angular/core';
import { addDoc, collection, deleteField, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ComId, comId, conversor } from '../../../core/firebase/conversor';
import { FIRESTORE } from '../../../core/firebase/firestore.token';
import { Atleta, AtletaGravado, StatusAtleta } from '../../../models/atleta.model';
import { Modalidade } from '../../../models/modalidade.model';
import { PosicoesAtleta, normalizarPosicoes } from '../../../models/posicao.model';

/** Vínculo de uma conta com o elenco: atleta existente (sem conta) ou novo, com a modalidade escolhida. */
export type VinculoAtleta = { tipo: 'existente'; atletaId: string } | { tipo: 'novo'; modalidade: Modalidade };

/** Campos editáveis pela diretoria. Opcionais ausentes não são gravados. */
export interface DadosAtleta {
  nome: string;
  apelido: string;
  telefone?: string;
  numeroCamisa?: number;
  modalidade: Modalidade;
  posicoes: PosicoesAtleta;
  status: StatusAtleta;
}

/** times/{timeId}/atletas. Leitura: todos do time; escrita: diretoria. */
@Injectable({ providedIn: 'root' })
export class AtletasService {
  private readonly firestore = inject(FIRESTORE);

  async listar(timeId: string): Promise<ComId<Atleta>[]> {
    const snap = await getDocs(query(this.colecao(timeId).withConverter(conversor<AtletaGravado>()), orderBy('nome')));
    return snap.docs.map((d) => {
      const atleta = comId(d);
      return { ...atleta, posicoes: normalizarPosicoes(atleta.posicoes) };
    });
  }

  async criar(timeId: string, dados: DadosAtleta): Promise<void> {
    await addDoc(this.colecao(timeId), {
      ...dados,
      uid: null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  }

  /** Substitui os campos editáveis; opcionais ausentes são removidos do documento. `uid` não muda aqui. */
  async atualizar(timeId: string, atletaId: string, dados: DadosAtleta): Promise<void> {
    await updateDoc(doc(this.colecao(timeId), atletaId), {
      ...dados,
      telefone: dados.telefone ?? deleteField(),
      numeroCamisa: dados.numeroCamisa ?? deleteField(),
      atualizadoEm: serverTimestamp(),
    });
  }

  /**
   * Jogador editando o próprio atleta: nome, apelido, telefone, posições e camisa.
   * Modalidade e status continuam com a diretoria (Rules).
   */
  async atualizarProprio(timeId: string, atletaId: string, dados: DadosAtleta): Promise<void> {
    await updateDoc(doc(this.colecao(timeId), atletaId), {
      nome: dados.nome,
      apelido: dados.apelido,
      posicoes: dados.posicoes,
      telefone: dados.telefone ?? deleteField(),
      numeroCamisa: dados.numeroCamisa ?? deleteField(),
      atualizadoEm: serverTimestamp(),
    });
  }

  /** Jogador sincronizando a própria foto (do Google) no atleta vinculado. null remove. */
  async atualizarFoto(timeId: string, atletaId: string, fotoUrl: string | null): Promise<void> {
    await updateDoc(doc(this.colecao(timeId), atletaId), {
      fotoUrl: fotoUrl ?? deleteField(),
      atualizadoEm: serverTimestamp(),
    });
  }

  private colecao(timeId: string) {
    return collection(this.firestore, 'times', timeId, 'atletas');
  }
}
