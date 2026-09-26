import { Timestamp } from 'firebase/firestore';
import { PapelTime } from './papel.model';

/** times/{timeId}/acessos/{uid} */
export interface Acesso {
  uid: string;
  timeId: string;
  timeNome: string;
  /** Nome da pessoa, desnormalizado para a lista de membros. */
  nome: string;
  papeis: PapelTime[];
  atletaId: string | null;
  concedidoPor: string;
  atualizadoEm: Timestamp;
}
