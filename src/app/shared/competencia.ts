// Referências de competência das cobranças (DIRETRIZES 2.4): mensal `AAAA-MM`, semestral `AAAA-S1`/`AAAA-S2`.

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const RE_MENSAL = /^(\d{4})-(\d{2})$/;
const RE_SEMESTRAL = /^(\d{4})-S([12])$/;

export function referenciaMensal(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function referenciaSemestral(data: Date): string {
  return `${data.getFullYear()}-S${data.getMonth() < 6 ? 1 : 2}`;
}

/** Referências mensais ao redor de hoje (mais recentes primeiro): `antes` meses atrás até `depois` à frente. */
export function referenciasMensais(hoje: Date, antes = 6, depois = 2): string[] {
  const lista: string[] = [];
  for (let i = depois; i >= -antes; i--) {
    lista.push(referenciaMensal(new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)));
  }
  return lista;
}

/** Semestre seguinte, atual e os dois anteriores. */
export function referenciasSemestrais(hoje: Date): string[] {
  return [6, 0, -6, -12].map((meses) =>
    referenciaSemestral(new Date(hoje.getFullYear(), hoje.getMonth() + meses, 1)),
  );
}

/** "2026-10" → "Outubro/2026"; "2026-S2" → "2º semestre/2026"; outros (eventoId) ficam como estão. */
export function rotuloReferencia(referencia: string): string {
  const mensal = RE_MENSAL.exec(referencia);
  if (mensal) return `${MESES[Number(mensal[2]) - 1]}/${mensal[1]}`;
  const semestral = RE_SEMESTRAL.exec(referencia);
  if (semestral) return `${semestral[2]}º semestre/${semestral[1]}`;
  return referencia;
}

/** Dia limitado ao último dia do mês (ex.: dia 31 em fevereiro vira 28/29). `mes` de 1 a 12. */
function dataNoMes(ano: number, mes: number, dia: number): Date {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return new Date(ano, mes - 1, Math.min(dia, ultimoDia));
}

export function vencimentoMensal(referencia: string, dia: number): Date {
  const [, ano, mes] = RE_MENSAL.exec(referencia) ?? [];
  return dataNoMes(Number(ano), Number(mes), dia);
}

export function vencimentoSemestral(referencia: string, dia: number, mesS1: number, mesS2: number): Date {
  const [, ano, semestre] = RE_SEMESTRAL.exec(referencia) ?? [];
  return dataNoMes(Number(ano), semestre === '1' ? mesS1 : mesS2, dia);
}

/** Data local em `AAAA-MM-DD` (valor de `<input type="date">`). */
export function paraDataInput(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** `AAAA-MM-DD` → Date ao meio-dia local (evita virar o dia por fuso). */
export function deDataInput(valor: string): Date {
  const [ano, mes, dia] = valor.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12);
}

export const NOMES_MESES = MESES;

/** `AAAA-MM` válido (mês 01–12). */
export function ehReferenciaMensal(valor: string | undefined): valor is string {
  return !!valor && RE_MENSAL.test(valor) && Number(valor.slice(5)) >= 1 && Number(valor.slice(5)) <= 12;
}

/** `AAAA-S1` ou `AAAA-S2`. */
export function ehReferenciaSemestral(valor: string | undefined): valor is string {
  return !!valor && RE_SEMESTRAL.test(valor);
}

/**
 * Período de navegação do financeiro: mês (`AAAA-MM`) ou semestre (`AAAA-S1`/`AAAA-S2`).
 * `somarPeriodos` anda no mesmo tipo: ("2026-12", 1) → "2027-01"; ("2026-S2", 1) → "2027-S1".
 */
export function somarPeriodos(periodo: string, quantidade: number): string {
  const { inicio } = intervaloDoPeriodo(periodo);
  const meses = ehReferenciaSemestral(periodo) ? quantidade * 6 : quantidade;
  const data = new Date(inicio.getFullYear(), inicio.getMonth() + meses, 1);
  return ehReferenciaSemestral(periodo) ? referenciaSemestral(data) : referenciaMensal(data);
}

/** Intervalo [início, fim) do mês ou semestre (datas locais). */
export function intervaloDoPeriodo(periodo: string): { inicio: Date; fim: Date } {
  const semestral = RE_SEMESTRAL.exec(periodo);
  if (semestral) {
    const ano = Number(semestral[1]);
    const mesInicial = semestral[2] === '1' ? 0 : 6;
    return { inicio: new Date(ano, mesInicial, 1), fim: new Date(ano, mesInicial + 6, 1) };
  }
  const [ano, mes] = periodo.split('-').map(Number);
  return { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 1) };
}
