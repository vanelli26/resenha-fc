import { Timestamp } from 'firebase/firestore';

/** times/{timeId}/convites/{codigo}. Reutilizável até expirar ou ser desativado. */
export interface Convite {
  /** Desnormalizado: quem abre o convite ainda não pode ler o time. */
  timeNome: string;
  ativo: boolean;
  expiraEm: Timestamp;
  criadoPor: string;
  criadoEm: Timestamp;
}

export const STATUS_SOLICITACAO = ['pendente', 'aprovada', 'recusada'] as const;
export type StatusSolicitacao = (typeof STATUS_SOLICITACAO)[number];

/** times/{timeId}/solicitacoes/{uid} */
export interface Solicitacao {
  nome: string;
  email: string;
  status: StatusSolicitacao;
  /** Código do convite usado. */
  convite: string;
  criadoEm: Timestamp;
}
