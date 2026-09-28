import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { ESPORTES, Esporte, POSICOES_POR_ESPORTE } from '../../models/posicao.model';
import { Avisos } from '../../shared/avisos';
import { ROTULO_ESPORTE, ROTULO_POSICAO } from '../../shared/rotulos';
import { Voltar } from '../../shared/voltar';
import { TimesService } from '../times/data/times.service';

/** Esportes praticados pelo time (diretoria ou adminGeral). Definem as posições no cadastro do atleta. */
@Component({
  selector: 'app-esportes-page',
  imports: [FormsModule, ButtonModule, ToggleSwitchModule, Voltar],
  templateUrl: './esportes-page.html',
  styleUrl: './esportes-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EsportesPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly timesService = inject(TimesService);
  private readonly avisos = inject(Avisos);

  protected readonly itens = ESPORTES.map((esporte) => ({
    esporte,
    rotulo: ROTULO_ESPORTE[esporte],
    posicoes: POSICOES_POR_ESPORTE[esporte].map((p) => ROTULO_POSICAO[p]).join(', '),
  }));

  /** Seleção na tela; volta ao gravado quando o time muda. */
  protected readonly selecionados = linkedSignal<ReadonlySet<Esporte>>(() => new Set(this.timeAtual.esportes()));
  protected readonly salvando = signal(false);
  protected readonly alterado = computed(() => {
    const atual = this.timeAtual.esportes();
    const sel = this.selecionados();
    return atual.length !== sel.size || atual.some((e) => !sel.has(e));
  });

  protected alternar(esporte: Esporte, ligado: boolean): void {
    this.selecionados.update((atual) => {
      const novo = new Set(atual);
      if (ligado) novo.add(esporte);
      else novo.delete(esporte);
      return novo;
    });
  }

  protected async salvar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const esportes = ESPORTES.filter((e) => this.selecionados().has(e));
    if (!timeId || esportes.length === 0) return;
    await this.avisos.executar(
      this.salvando,
      async () => {
        await this.timesService.salvarEsportes(timeId, esportes);
        this.timeAtual.definirEsportes(esportes);
      },
      'Esportes atualizados',
      'Não foi possível salvar',
    );
  }
}
