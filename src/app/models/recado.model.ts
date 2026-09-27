import { Timestamp } from 'firebase/firestore';

/** Até 4 fotos por postagem (Storage: times/{timeId}/recados/{id}/{N}.webp). */
export const MAX_FOTOS_POST = 4;

export interface FotoPost {
  /** URL de download (com token) do Storage. */
  url: string;
  /** Caminho no Storage, para apagar junto com o post. */
  caminho: string;
  largura: number;
  altura: number;
}

/**
 * times/{timeId}/recados/{id} — postagem do mural (DIRETRIZES 2.8). Qualquer membro publica.
 * Posts antigos (só da diretoria) têm `titulo` e não têm fotos.
 */
export interface Recado {
  titulo?: string;
  /** Legenda; pode ser vazia quando há foto. Quebras de linha são mantidas. */
  texto: string;
  fotos?: FotoPost[];
  /** Fixados aparecem no topo (só a diretoria fixa). */
  fixado: boolean;
  autorUid: string;
  /** Desnormalizados para exibição (3.2). */
  autorNome: string;
  autorFotoUrl?: string;
  criadoEm: Timestamp;
  /** Contador de curtidas (±1 junto com recados/{id}/curtidas/{uid}; validado nas Rules). */
  qtdCurtidas?: number;
}

/** times/{timeId}/recados/{id}/curtidas/{uid} — existir = curtiu. */
export interface Curtida {
  criadoEm: Timestamp;
}

export const MAX_COMENTARIO = 500;

/** times/{timeId}/recados/{id}/comentarios/{id}. Não é editado; exclui o autor ou a diretoria. */
export interface Comentario {
  texto: string;
  autorUid: string;
  autorNome: string;
  autorFotoUrl?: string;
  criadoEm: Timestamp;
}
