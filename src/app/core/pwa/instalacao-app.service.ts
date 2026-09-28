import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/** Evento do Chrome/Android para instalar o app (não faz parte do lib.dom). */
interface PedidoInstalacao extends Event {
  prompt(): Promise<void>;
}

function ehPedidoInstalacao(evento: Event): evento is PedidoInstalacao {
  return 'prompt' in evento && typeof evento.prompt === 'function';
}

/**
 * "Instalar app" (DIRETRIZES 6.3): no Chrome/Android guarda o pedido nativo de instalação para usar no menu;
 * no iPhone (Safari não tem pedido) o menu mostra as instruções. Aberto como app instalado, some.
 */
@Injectable({ providedIn: 'root' })
export class InstalacaoApp {
  private readonly janela = inject(DOCUMENT).defaultView;
  private pedido: PedidoInstalacao | null = null;

  /** Pedido nativo disponível (Chrome/Android/desktop). */
  readonly podePedir = signal(false);
  /** iPhone/iPad no navegador: instalar é pelo menu Compartilhar. */
  readonly ehIosNoNavegador = signal(false);

  iniciar(): void {
    const janela = this.janela;
    if (!janela) return;
    const instalado =
      janela.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in janela.navigator && janela.navigator.standalone === true);
    if (instalado) return;
    this.ehIosNoNavegador.set(/iphone|ipad|ipod/i.test(janela.navigator.userAgent));
    janela.addEventListener('beforeinstallprompt', (evento) => {
      if (!ehPedidoInstalacao(evento)) return;
      evento.preventDefault();
      this.pedido = evento;
      this.podePedir.set(true);
    });
    janela.addEventListener('appinstalled', () => {
      this.pedido = null;
      this.podePedir.set(false);
    });
  }

  /** Abre o pedido nativo; o navegador só permite usá-lo uma vez. */
  async instalar(): Promise<void> {
    const pedido = this.pedido;
    if (!pedido) return;
    this.pedido = null;
    this.podePedir.set(false);
    await pedido.prompt();
  }
}
