import { Timestamp } from 'firebase/firestore';

/** times/{timeId}/recados/{id}. Publicado pela diretoria; todos do time leem (DIRETRIZES 2.8). */
export interface Recado {
  titulo: string;
  /** Texto simples; quebras de linha são mantidas na exibição. */
  texto: string;
  /** Fixados aparecem no topo. */
  fixado: boolean;
  autorUid: string;
  /** Desnormalizado para exibição (3.2). */
  autorNome: string;
  criadoEm: Timestamp;
}
