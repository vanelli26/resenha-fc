import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { Copy } from '@primeicons/angular/copy';
import { Whatsapp } from '@primeicons/angular/whatsapp';
import { ButtonModule } from 'primeng/button';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Evento } from '../../models/evento.model';
import { Avisos } from '../../shared/avisos';
import { abrirWhatsApp, copiarTexto } from '../../shared/compartilhar';

/**
 * "Chamar o time" (DIRETRIZES 2.7): mensagem pronta para o grupo do WhatsApp, ou copiar, com o link
 * direto do evento. Quem não está logado entra e volta para o evento (authGuard guarda a URL).
 */
@Component({
  selector: 'app-chamar-time',
  imports: [ButtonModule, Copy, Whatsapp],
  template: `
    <p-button size="small" severity="success" ariaLabel="Chamar o time no WhatsApp" (onClick)="enviar()">
      <svg data-p-icon="whatsapp" [size]="16" aria-hidden="true"></svg>
      <span>Chamar</span>
    </p-button>
    <p-button size="small" [outlined]="true" severity="secondary" ariaLabel="Copiar mensagem com o link" (onClick)="copiar()">
      <svg data-p-icon="copy" [size]="16" aria-hidden="true"></svg>
    </p-button>
  `,
  styles: `
    :host {
      display: flex;
      gap: 0.375rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChamarTime {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly avisos = inject(Avisos);
  private readonly locale = inject(LOCALE_ID);

  readonly evento = input.required<ComId<Evento>>();

  private readonly link = computed(
    () => `${location.origin}/t/${this.timeAtual.timeId()}/agenda/${this.evento().id}`,
  );

  /** Negrito no formato do WhatsApp. */
  private readonly mensagem = computed(() => {
    const e = this.evento();
    const quando = formatDate(e.data.toDate(), "EEE, dd/MM 'às' HH:mm", this.locale);
    return [
      `⚽ *${e.titulo}*${e.adversario ? ` x ${e.adversario}` : ''}`,
      `📅 ${quando.charAt(0).toUpperCase()}${quando.slice(1)}`,
      ...(e.local ? [`📍 ${e.local}`] : []),
      '',
      `Confirme sua presença: ${this.link()}`,
    ].join('\n');
  });

  protected enviar(): void {
    abrirWhatsApp(this.mensagem());
  }

  protected async copiar(): Promise<void> {
    if (await copiarTexto(this.mensagem())) this.avisos.sucesso('Mensagem copiada', 'Cole no grupo do time.');
    else this.avisos.info('Não foi possível copiar', this.link(), 10000);
  }
}
