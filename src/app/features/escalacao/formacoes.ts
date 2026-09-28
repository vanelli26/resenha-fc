export interface Vaga {
  /** Índice gravado em `Titular.vaga`. */
  indice: number;
  rotulo: 'Goleiro' | 'Defesa' | 'Meio' | 'Ataque';
  /** Posição no campinho, em % (x da esquerda; y do topo = ataque). */
  x: number;
  y: number;
}

/** "2-3-1" → [2, 3, 1]. */
function linhas(formacao: string): number[] {
  return formacao.split('-').map(Number);
}

export function jogadoresNaFormacao(formacao: string): number {
  return linhas(formacao).reduce((soma, n) => soma + n, 1);
}

function rotuloDaLinha(linha: number, total: number): Vaga['rotulo'] {
  if (linha === 0) return 'Defesa';
  return linha === total - 1 ? 'Ataque' : 'Meio';
}

/** Vagas da formação: goleiro embaixo, linhas distribuídas até o ataque; jogadores espalhados na largura. */
export function vagasDaFormacao(formacao: string): Vaga[] {
  const ls = linhas(formacao);
  const vagas: Vaga[] = [{ indice: 0, rotulo: 'Goleiro', x: 50, y: 90 }];
  const yDefesa = 70;
  const yAtaque = 18;
  ls.forEach((qtd, linha) => {
    const y = ls.length === 1 ? (yDefesa + yAtaque) / 2 : yDefesa - ((yDefesa - yAtaque) * linha) / (ls.length - 1);
    for (let i = 0; i < qtd; i++) {
      vagas.push({ indice: vagas.length, rotulo: rotuloDaLinha(linha, ls.length), x: ((i + 1) * 100) / (qtd + 1), y });
    }
  });
  return vagas;
}
