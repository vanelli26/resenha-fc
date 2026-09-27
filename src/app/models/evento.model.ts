import { Timestamp } from 'firebase/firestore';
import { Esporte } from './posicao.model';

export const TIPOS_EVENTO = ['jogo', 'treino', 'amistoso', 'campeonato', 'confraternizacao', 'outro'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const STATUS_EVENTO = ['agendado', 'realizado', 'cancelado'] as const;
export type StatusEvento = (typeof STATUS_EVENTO)[number];

/** Tipos em que qualquer cadastro ativo responde presença; nos demais, só atletas (DIRETRIZES 2.7). */
export const TIPOS_EVENTO_ABERTOS: readonly TipoEvento[] = ['confraternizacao', 'outro'];

/** Tipos com adversário. */
export const TIPOS_COM_ADVERSARIO: readonly TipoEvento[] = ['jogo', 'amistoso', 'campeonato'];

/** times/{timeId}/eventos/{eventoId}. Não é excluído: sai da agenda como `cancelado`. */
export interface Evento {
  tipo: TipoEvento;
  titulo: string;
  data: Timestamp;
  /** Pode ser vazio. */
  local: string;
  esporte: Esporte;
  adversario?: string;
  /** Placar (0..99), informado no encerramento. Campeonato: Fase 4. */
  placarPro?: number;
  placarContra?: number;
  status: StatusEvento;
  campeonatoId?: string;
  criadoPor: string;
  criadoEm: Timestamp;
}

export const RESPOSTAS_PRESENCA = ['vou', 'nao_vou', 'talvez'] as const;
export type RespostaPresenca = (typeof RESPOSTAS_PRESENCA)[number];

/** times/{timeId}/eventos/{eventoId}/presencas/{atletaId} */
export interface Presenca {
  /** Ausente quando a diretoria marcou `compareceu` de quem não respondeu. */
  resposta?: RespostaPresenca;
  /** Marcado pela diretoria ao encerrar (3b). */
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
