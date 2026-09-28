import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Tempo mínimo entre verificações ao voltar para o app (evita checar a cada troca de aba). */
const INTERVALO_VERIFICACAO_MS = 5 * 60 * 1000;

/**
 * Versões novas do app (service worker, DIRETRIZES 6.3): quando uma versão é baixada em segundo plano,
 * `disponivel` liga e o shell oferece "Atualizar". Confere de novo ao voltar para o app.
 */
@Injectable({ providedIn: 'root' })
export class AtualizacaoApp {
  private readonly sw = inject(SwUpdate);
  private readonly documento = inject(DOCUMENT);

  readonly disponivel = signal(false);
  private ultimaVerificacao = Date.now();

  iniciar(): void {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates.subscribe((evento) => {
      if (evento.type === 'VERSION_READY') this.disponivel.set(true);
    });
    // Cache do aparelho quebrado (ex.: arquivos apagados pelo sistema): só recarregar resolve.
    this.sw.unrecoverable.subscribe(() => this.documento.location.reload());
    this.documento.addEventListener('visibilitychange', () => {
      if (this.documento.visibilityState !== 'visible') return;
      if (Date.now() - this.ultimaVerificacao < INTERVALO_VERIFICACAO_MS) return;
      this.ultimaVerificacao = Date.now();
      void this.sw.checkForUpdate().catch(() => undefined);
    });
  }

  async atualizar(): Promise<void> {
    await this.sw.activateUpdate().catch(() => undefined);
    this.documento.location.reload();
  }
}
