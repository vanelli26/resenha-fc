import { Timestamp } from 'firebase/firestore';

export const TIPOS_EVENTO = ['jogo', 'treino', 'amistoso', 'campeonato', 'confraternizacao', 'outro'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const STATUS_EVENTO = ['agendado', 'realizado', 'cancelado'] as const;
export type StatusEvento = (typeof STATUS_EVENTO)[number];

/** times/{timeId}/eventos/{eventoId} */
export interface Evento {
  tipo: TipoEvento;
  titulo: string;
  data: Timestamp;
  local: string;
  adversario?: string;
  placarPro?: number;
  placarContra?: number;
  status: StatusEvento;
  campeonatoId?: string;
  criadoPor: string;
}

export const RESPOSTAS_PRESENCA = ['vou', 'nao_vou', 'talvez'] as const;
export type RespostaPresenca = (typeof RESPOSTAS_PRESENCA)[number];

/** times/{timeId}/eventos/{eventoId}/presencas/{atletaId} */
export interface Presenca {
  resposta: RespostaPresenca;
  compareceu?: boolean;
  atualizadoEm: Timestamp;
}

export interface Titular {
  atletaId: string;
  posicao: string;
  x: number;
  y: number;
}

/** times/{timeId}/eventos/{eventoId}/escalacao/principal */
export interface Escalacao {
  formacao: string;
  titulares: Titular[];
  /** atletaIds. */
  reservas: string[];
}
