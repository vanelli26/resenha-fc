import { Timestamp } from 'firebase/firestore';

/** times/{timeId}/recados/{id} */
export interface Recado {
  titulo: string;
  texto: string;
  fixado: boolean;
  autorUid: string;
  autorNome: string;
  criadoEm: Timestamp;
}
