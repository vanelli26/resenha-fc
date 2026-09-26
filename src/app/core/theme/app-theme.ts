// Base: preset Aura, superfícies em zinc. A cor primária vem da cor do time (DIRETRIZES 6.1).
import { definePreset, updatePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { CorTime } from '../../models/time.model';

const TONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// Cor do app fora de um time: verde gramado.
const COR_BASE: CorTime = 'emerald';

// Paletas claras recebem texto preto sobre a primária (contraste).
const CORES_CLARAS: ReadonlySet<CorTime> = new Set(['yellow', 'amber', 'lime', 'cyan', 'sky']);

function paleta(nome: string): Record<string, string> {
  return Object.fromEntries(TONS.map((tom) => [tom, `{${nome}.${tom}}`]));
}

function semanticDaCor(cor: CorTime) {
  // Preto e branco: primária preta no claro, branca no escuro.
  if (cor === 'preto') {
    return {
      primary: paleta('zinc'),
      colorScheme: {
        light: { primary: { color: '{zinc.950}', contrastColor: '#ffffff', hoverColor: '{zinc.800}', activeColor: '{zinc.700}' } },
        dark: { primary: { color: '{zinc.50}', contrastColor: '{zinc.950}', hoverColor: '{zinc.200}', activeColor: '{zinc.300}' } },
      },
    };
  }

  if (CORES_CLARAS.has(cor)) {
    return {
      primary: paleta(cor),
      colorScheme: {
        light: { primary: { color: `{${cor}.400}`, contrastColor: '{zinc.950}', hoverColor: `{${cor}.500}`, activeColor: `{${cor}.600}` } },
        dark: { primary: { color: `{${cor}.400}`, contrastColor: '{zinc.950}', hoverColor: `{${cor}.300}`, activeColor: `{${cor}.200}` } },
      },
    };
  }

  return {
    primary: paleta(cor),
    colorScheme: {
      light: { primary: { color: `{${cor}.600}`, contrastColor: '#ffffff', hoverColor: `{${cor}.700}`, activeColor: `{${cor}.800}` } },
      dark: { primary: { color: `{${cor}.400}`, contrastColor: '{zinc.950}', hoverColor: `{${cor}.300}`, activeColor: `{${cor}.200}` } },
    },
  };
}

const semanticBase = semanticDaCor(COR_BASE);

export const AppPreset = definePreset(Aura, {
  semantic: {
    ...semanticBase,
    colorScheme: {
      light: { ...semanticBase.colorScheme.light, surface: paleta('zinc') },
      dark: { ...semanticBase.colorScheme.dark, surface: paleta('zinc') },
    },
  },
});

/** Chamado ao entrar/sair de um time (null = fora de um time). */
export function aplicarTemaDoTime(cor: CorTime | null): void {
  updatePreset({ semantic: semanticDaCor(cor ?? COR_BASE) });
}

/** Amostra da cor para seletores (token CSS da paleta, nunca hex solto). */
export function amostraDaCor(cor: CorTime): string {
  return cor === 'preto' ? 'var(--p-zinc-950)' : `var(--p-${cor}-500)`;
}
