import { Timestamp } from 'firebase/firestore';

/** usuarios/{uid} */
export interface Usuario {
  nome: string;
  email: string;
  fotoUrl: string | null;
  criadoEm: Timestamp;
  /** Só alterável pelo console/Admin SDK. Ausente = false. */
  adminGeral?: boolean;
}
