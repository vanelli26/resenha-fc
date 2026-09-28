import { Timestamp } from 'firebase/firestore';
import { CorTime } from './time.model';

export const STATUS_PEDIDO_TIME = ['pendente', 'aprovado', 'reprovado'] as const;
export type StatusPedidoTime = (typeof STATUS_PEDIDO_TIME)[number];

/** Motivo da reprovação (opcional). */
export const MAX_MOTIVO_PEDIDO = 200;

/**
 * pedidosTime/{slug} — pedido de criação de time (DIRETRIZES 2.12). O id é o endereço pedido; o adminGeral
 * aprova ou reprova; aprovado, quem pediu cria o time com esse nome e cor e vira diretoria e tesouraria.
 */
export interface PedidoTime {
  nome: string;
  cor: CorTime;
  solicitanteUid: string;
  solicitanteNome: string;
  solicitanteEmail: string;
  status: StatusPedidoTime;
  motivo?: string;
  criadoEm: Timestamp;
  decididoEm?: Timestamp;
  decididoPor?: string;
}
