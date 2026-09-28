import { Injectable, WritableSignal, inject } from '@angular/core';
import { Confirmation, MessageService } from 'primeng/api';
import { mensagemDeErro } from './erros';

/**
 * Avisos (toasts) padronizados das telas (DIRETRIZES 6.2): resumo curto no título, motivo no detalhe.
 * Erros do Firebase viram texto amigável via `mensagemDeErro`.
 */
@Injectable({ providedIn: 'root' })
export class Avisos {
  private readonly mensagens = inject(MessageService);

  sucesso(resumo: string, detalhe?: string): void {
    this.mensagens.add({ severity: 'success', summary: resumo, detail: detalhe });
  }

  info(resumo: string, detalhe: string, duracaoMs?: number): void {
    this.mensagens.add({ severity: 'info', summary: resumo, detail: detalhe, life: duracaoMs });
  }

  atencao(detalhe: string, resumo = 'Atenção'): void {
    this.mensagens.add({ severity: 'warn', summary: resumo, detail: detalhe });
  }

  erro(resumo: string, e: unknown): void {
    this.mensagens.add({ severity: 'error', summary: resumo, detail: mensagemDeErro(e) });
  }

  /**
   * Escrita disparada pelo usuário: liga `ocupado` durante a ação, avisa sucesso (se houver texto) ou erro.
   * Retorna se deu certo; recarregar dados ou fechar diálogo fica com quem chama.
   */
  async executar(
    ocupado: WritableSignal<boolean>,
    acao: () => Promise<unknown>,
    sucesso: string | null,
    resumoErro = 'Não foi possível concluir',
  ): Promise<boolean> {
    ocupado.set(true);
    try {
      await acao();
      if (sucesso) this.sucesso(sucesso);
      return true;
    } catch (e) {
      this.erro(resumoErro, e);
      return false;
    } finally {
      ocupado.set(false);
    }
  }
}

export interface OpcoesConfirmacao {
  titulo: string;
  mensagem: string;
  /** Texto do botão de aceite (ex.: "Excluir", "Remover"). */
  rotulo: string;
  /** Ação destrutiva: botão vermelho. Padrão: sim. */
  perigosa?: boolean;
  aoConfirmar: () => void;
}

/** Diálogo de confirmação padrão ("Voltar" discreto). Uso: `this.confirmacao.confirm(confirmacaoPadrao({...}))`. */
export function confirmacaoPadrao(opcoes: OpcoesConfirmacao): Confirmation {
  return {
    header: opcoes.titulo,
    message: opcoes.mensagem,
    acceptLabel: opcoes.rotulo,
    rejectLabel: 'Voltar',
    acceptButtonProps: { severity: opcoes.perigosa === false ? 'primary' : 'danger' },
    rejectButtonProps: { text: true },
    accept: opcoes.aoConfirmar,
  };
}
