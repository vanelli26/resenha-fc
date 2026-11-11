import { formatDate } from '@angular/common';
import { ComId } from '../../core/firebase/conversor';
import { Cobranca } from '../../models/financeiro.model';
import { formatarReais } from '../../shared/dinheiro';
import { competenciaDaCobranca, nomeDaCobranca } from './data/cobrancas.service';
import { situacaoDaCobranca } from './situacao-cobranca';

export interface DadosMensagemCobranca {
  timeNome: string;
  /** Nome da pessoa (do cadastro ou o da cobrança). */
  nome: string;
  /** Pendentes da pessoa (a tocada e as demais carregadas na tela). */
  cobrancas: readonly ComId<Cobranca>[];
  /** Link de Minhas cobranças no app. */
  link: string;
  locale: string;
  hoje?: Date;
}

/**
 * Texto da cobrança para o WhatsApp da pessoa (DIRETRIZES 2.5): cada pendente com plano, competência,
 * valor, vencimento e se está atrasada; total quando há mais de uma; link para ver no app.
 */
export function mensagemDeCobranca(d: DadosMensagemCobranca): string {
  const hoje = d.hoje ?? new Date();
  const ordenadas = [...d.cobrancas].sort((a, b) => a.vencimento.toMillis() - b.vencimento.toMillis());
  const primeiroNome = d.nome.trim().split(/\s+/)[0] ?? d.nome;
  const reais = (centavos: number) => formatarReais(centavos, d.locale);

  const linhas = ordenadas.map((c) => {
    const atrasada = situacaoDaCobranca(c, hoje) === 'atrasado';
    const vencimento = formatDate(c.vencimento.toDate(), 'dd/MM/yyyy', d.locale);
    return (
      `• ${nomeDaCobranca(c)} · ${competenciaDaCobranca(c)}\n` +
      `  Valor: ${reais(c.valorCentavos)} · Vencimento: ${vencimento}${atrasada ? ' (em atraso)' : ''}`
    );
  });
  const total = ordenadas.reduce((soma, c) => soma + c.valorCentavos, 0);

  return [
    `Olá, ${primeiroNome}! Aqui é a tesouraria do ${d.timeNome}.`,
    '',
    ordenadas.length === 1 ? 'Você tem uma cobrança em aberto:' : `Você tem ${ordenadas.length} cobranças em aberto:`,
    ...linhas,
    ...(ordenadas.length > 1 ? ['', `Total: ${reais(total)}`] : []),
    '',
    'Depois de pagar, avise por aqui para darmos baixa.',
    `Se você usa o ResenhaFC, veja suas cobranças em: ${d.link}`,
  ].join('\n');
}
