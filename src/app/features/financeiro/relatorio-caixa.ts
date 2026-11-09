import { ComId } from '../../core/firebase/conversor';
import { Cobranca, FORMAS_PAGAMENTO, Lancamento, TipoLancamento, formaDaObservacao } from '../../models/financeiro.model';
import { ROTULO_FORMA_PAGAMENTO } from '../../shared/rotulos';

/**
 * Origem do dinheiro no relatório do caixa: a forma de pagamento da cobrança (receitas de baixa) ou
 * `manual` (lançamentos feitos no Caixa e despesas recorrentes, que não têm forma).
 */
export const ORIGENS_CAIXA = [...FORMAS_PAGAMENTO, 'manual'] as const;
export type OrigemCaixa = (typeof ORIGENS_CAIXA)[number];

export const ROTULO_ORIGEM_CAIXA: Record<OrigemCaixa, string> = {
  ...ROTULO_FORMA_PAGAMENTO,
  manual: 'Lançamento manual',
};

export interface FiltroRelatorio {
  tipo: TipoLancamento | null;
  origem: OrigemCaixa | null;
}

export interface MovimentoCaixa {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valorCentavos: number;
  data: Date;
  origem: OrigemCaixa;
  /** Saldo do caixa logo após este lançamento, com todos os lançamentos (extrato). */
  saldo: number;
}

export interface DiaCaixa {
  /** `AAAA-MM-DD` local. */
  chave: string;
  data: Date;
  movimentos: MovimentoCaixa[];
  entradas: number;
  saidas: number;
  /** Saldo do caixa ao fim do dia, com todos os lançamentos (mesmo com filtro). */
  saldo: number;
}

export interface RelatorioCaixa {
  saldoAnterior: number;
  /** Entradas e saídas do período, já filtradas. */
  entradas: number;
  saidas: number;
  /** Saldo anterior + todas as entradas − todas as saídas do período (ignora o filtro). */
  saldoFinal: number;
  dias: DiaCaixa[];
  quantidade: number;
}

/** Forma da receita de baixa (pela observação da cobrança); demais lançamentos são manuais. */
function origemDoLancamento(lancamento: ComId<Lancamento>, cobrancas: ReadonlyMap<string, Cobranca>): OrigemCaixa {
  if (!lancamento.cobrancaId) return 'manual';
  const cobranca = cobrancas.get(lancamento.cobrancaId);
  return cobranca ? formaDaObservacao(cobranca.observacao) : 'nao_informada';
}

function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function passaNoFiltro(m: MovimentoCaixa, filtro: FiltroRelatorio): boolean {
  return (!filtro.tipo || m.tipo === filtro.tipo) && (!filtro.origem || m.origem === filtro.origem);
}

/**
 * Linha do tempo do caixa pela data do lançamento (data do pagamento, na baixa), do mais antigo ao mais novo.
 * O saldo de cada dia e o final usam todos os lançamentos; o filtro só escolhe o que aparece e entra nos totais.
 */
export function montarRelatorio(
  saldoAnterior: number,
  lancamentos: readonly ComId<Lancamento>[],
  cobrancas: readonly ComId<Cobranca>[],
  filtro: FiltroRelatorio,
): RelatorioCaixa {
  const porId = new Map<string, Cobranca>(cobrancas.map((c) => [c.id, c]));
  const movimentos: MovimentoCaixa[] = lancamentos
    .map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      categoria: l.categoria,
      valorCentavos: l.valorCentavos,
      data: l.data.toDate(),
      origem: origemDoLancamento(l, porId),
      saldo: 0,
    }))
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  const dias: DiaCaixa[] = [];
  let saldo = saldoAnterior;
  let entradas = 0;
  let saidas = 0;
  let quantidade = 0;

  for (const m of movimentos) {
    const chave = chaveDoDia(m.data);
    let diaAtual = dias.at(-1);
    if (diaAtual?.chave !== chave) {
      diaAtual = { chave, data: m.data, movimentos: [], entradas: 0, saidas: 0, saldo };
      dias.push(diaAtual);
    }
    saldo += m.tipo === 'receita' ? m.valorCentavos : -m.valorCentavos;
    m.saldo = saldo;
    diaAtual.saldo = saldo;
    if (!passaNoFiltro(m, filtro)) continue;
    diaAtual.movimentos.push(m);
    quantidade++;
    if (m.tipo === 'receita') {
      diaAtual.entradas += m.valorCentavos;
      entradas += m.valorCentavos;
    } else {
      diaAtual.saidas += m.valorCentavos;
      saidas += m.valorCentavos;
    }
  }

  return {
    saldoAnterior,
    entradas,
    saidas,
    saldoFinal: saldo,
    dias: dias.filter((d) => d.movimentos.length > 0),
    quantidade,
  };
}
