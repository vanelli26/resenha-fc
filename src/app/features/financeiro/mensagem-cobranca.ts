import { formatDate } from '@angular/common';
import { Cobranca } from '../../models/financeiro.model';
import { formatarReais } from '../../shared/dinheiro';
import { competenciaDaCobranca, nomeDaCobranca } from './data/cobrancas.service';
import { situacaoDaCobranca } from './situacao-cobranca';

/** Campos que a tesouraria pode usar no modelo da mensagem (Configuração financeira). */
export const CAMPOS_MENSAGEM = [
  { campo: '{nome}', descricao: 'primeiro nome (ou apelido) da pessoa' },
  { campo: '{time}', descricao: 'nome do time' },
  { campo: '{cobrancas}', descricao: 'lista das pendentes: plano, competência, valor, vencimento e atraso' },
  { campo: '{total}', descricao: 'soma das pendentes' },
  { campo: '{pix}', descricao: 'chave Pix (sem chave, a linha inteira sai da mensagem)' },
  { campo: '{link}', descricao: 'link de Minhas cobranças no app' },
] as const;

/** Modelo usado quando o time não personalizou (DIRETRIZES 2.5). */
export const MENSAGEM_COBRANCA_PADRAO = [
  'Olá, {nome}! Aqui é a tesouraria do {time}.',
  '',
  '{cobrancas}',
  '',
  'Total: {total}',
  'Pix para pagamento: {pix}',
  '',
  'Depois de pagar, avise por aqui para darmos baixa.',
  'Se você usa o ResenhaFC, veja suas cobranças em: {link}',
].join('\n');

/** Uma pendente na mensagem (dados prontos; ver `itemDaCobranca`). */
export interface ItemMensagem {
  /** Plano e competência, ex.: "Mensalidade · Novembro/2026". */
  rotulo: string;
  valorCentavos: number;
  vencimento: Date;
  atrasada: boolean;
}

export function itemDaCobranca(c: Cobranca, hoje = new Date()): ItemMensagem {
  return {
    rotulo: `${nomeDaCobranca(c)} · ${competenciaDaCobranca(c)}`,
    valorCentavos: c.valorCentavos,
    vencimento: c.vencimento.toDate(),
    atrasada: situacaoDaCobranca(c, hoje) === 'atrasado',
  };
}

export interface DadosMensagemCobranca {
  timeNome: string;
  /** Nome da pessoa (do cadastro ou o da cobrança). */
  nome: string;
  /** Pendentes da pessoa (a tocada e as demais carregadas na tela). */
  itens: readonly ItemMensagem[];
  /** Link de Minhas cobranças no app. */
  link: string;
  locale: string;
  /** Modelo do time; vazio = padrão. */
  modelo?: string;
  chavePix?: string;
}

/**
 * Texto da cobrança para o WhatsApp da pessoa: o modelo do time (ou o padrão) com os campos preenchidos.
 * Linhas com {pix} saem quando o time não tem chave Pix.
 */
export function mensagemDeCobranca(d: DadosMensagemCobranca): string {
  const ordenadas = [...d.itens].sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime());
  const reais = (centavos: number) => formatarReais(centavos, d.locale);

  const itens = ordenadas.map((c) => {
    const vencimento = formatDate(c.vencimento, 'dd/MM/yyyy', d.locale);
    return (
      `• ${c.rotulo}\n` +
      `  Valor: ${reais(c.valorCentavos)} · Vencimento: ${vencimento}${c.atrasada ? ' (em atraso)' : ''}`
    );
  });
  const cabecalho =
    ordenadas.length === 1 ? 'Você tem uma cobrança em aberto:' : `Você tem ${ordenadas.length} cobranças em aberto:`;

  const valores: Record<string, string> = {
    '{nome}': d.nome.trim().split(/\s+/)[0] ?? d.nome,
    '{time}': d.timeNome,
    '{cobrancas}': [cabecalho, ...itens].join('\n'),
    '{total}': reais(ordenadas.reduce((soma, c) => soma + c.valorCentavos, 0)),
    '{pix}': d.chavePix?.trim() ?? '',
    '{link}': d.link,
  };

  const modelo = d.modelo?.trim() ? d.modelo : MENSAGEM_COBRANCA_PADRAO;
  return modelo
    .split('\n')
    .filter((linha) => !linha.includes('{pix}') || !!valores['{pix}'])
    .join('\n')
    .replace(/\{(nome|time|cobrancas|total|pix|link)\}/g, (campo) => valores[campo])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
