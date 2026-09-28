import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Tempo mínimo entre verificações ao voltar para o app (evita checar a cada troca de aba). */
const INTERVALO_VERIFICACAO_MS = 5 * 60 * 1000;
/** Espera máxima pela ativação da versão nova antes de recarregar. */
const LIMITE_ATIVACAO_MS = 3000;

/**
 * Versões novas do app (service worker, DIRETRIZES 6.3): quando uma versão é baixada em segundo plano,
 * `disponivel` liga e o shell oferece "Atualizar". Confere de novo ao voltar para o app.
 */
@Injectable({ providedIn: 'root' })
export class AtualizacaoApp {
  private readonly sw = inject(SwUpdate);
  private readonly documento = inject(DOCUMENT);

  readonly disponivel = signal(false);
  /** Botão "Atualizar" em andamento (mostra carregando até recarregar). */
  readonly atualizando = signal(false);
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

  /**
   * Troca para a versão nova e recarrega. A confirmação do service worker pode não chegar (ex.: troca do
   * script do worker); após o limite recarrega mesmo assim: a página recarregada já recebe a versão nova.
   */
  async atualizar(): Promise<void> {
    if (this.atualizando()) return;
    this.atualizando.set(true);
    const limite = new Promise<void>((resolver) => setTimeout(resolver, LIMITE_ATIVACAO_MS));
    await Promise.race([this.sw.activateUpdate().catch(() => undefined), limite]);
    this.documento.location.reload();
  }
}
