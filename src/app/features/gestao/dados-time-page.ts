import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SessaoService } from '../../core/sessao/sessao.service';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { CorTime } from '../../models/time.model';
import { Avisos } from '../../shared/avisos';
import { SeletorCor } from '../../shared/seletor-cor';
import { EscolhaEscudo, SeletorEscudo } from '../../shared/seletor-escudo';
import { Voltar } from '../../shared/voltar';
import { TimesService } from '../times/data/times.service';

interface FormIdentidade {
  nome: string;
  cor: CorTime;
}

/** Nome, cor e escudo do time (diretoria; DIRETRIZES 2.12). O endereço (/t/…) não muda. */
@Component({
  selector: 'app-dados-time-page',
  imports: [FormField, ButtonModule, InputTextModule, SeletorCor, SeletorEscudo, Voltar],
  template: `
    <app-voltar para="gestao" rotulo="Gestão" />

    <div class="cabecalho-secao">
      <h2>Dados do time</h2>
    </div>

    @if (timeAtual.time(); as t) {
      <form class="cartao formulario" (submit)="$event.preventDefault(); salvar()">
        <label class="campo">
          <span>Nome</span>
          <input pInputText [formField]="formulario.nome" autocomplete="off" />
          @if (formulario.nome().touched() && formulario.nome().invalid()) {
            <small class="campo__erro">{{ formulario.nome().errors()[0].message }}</small>
          }
        </label>

        <app-seletor-escudo [atual]="t.escudo" [nome]="modelo().nome" [(escolha)]="escolhaEscudo" />

        <app-seletor-cor [formField]="formulario.cor" />

        <small class="texto-suave">Endereço do time: /t/{{ t.id }} (não muda).</small>

        <div class="acoes">
          <p-button label="Salvar" type="submit" [loading]="salvando()" [disabled]="processandoImagem()" />
        </div>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DadosTimePage {
  protected readonly timeAtual = inject(TimeAtualService);
  private readonly timesService = inject(TimesService);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(Avisos);

  protected readonly salvando = signal(false);
  /** Volta a "manter" quando o time muda (tela reaproveitada). */
  protected readonly escolhaEscudo = linkedSignal<EscolhaEscudo>(() => {
    this.timeAtual.timeId();
    return { tipo: 'manter' };
  });
  private readonly seletorEscudo = viewChild(SeletorEscudo);
  protected readonly processandoImagem = computed(() => this.seletorEscudo()?.processando() ?? false);

  protected readonly modelo = linkedSignal<FormIdentidade>(() => {
    const t = this.timeAtual.time();
    return { nome: t?.nome ?? '', cor: t?.cor ?? 'emerald' };
  });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 60, { message: 'Máximo de 60 caracteres.' });
  });

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const time = this.timeAtual.time();
      if (!time) return;
      const nome = this.modelo().nome.trim();
      const cor = this.modelo().cor;
      let escudoFinal: string | null = time.escudo ?? null;
      const ok = await this.avisos.executar(
        this.salvando,
        async () => {
          escudoFinal = await this.timesService.gravarComEscudo(time.id, time.escudo ?? null, this.escolhaEscudo(), (escudo) =>
            this.timesService.salvarIdentidade(time.id, { nome, cor, escudo }),
          );
        },
        'Dados do time salvos',
        'Não foi possível salvar',
      );
      if (!ok) return;
      this.timeAtual.definirIdentidade({ nome, cor, escudo: escudoFinal });
      this.escolhaEscudo.set({ tipo: 'manter' });
      // Seletor de time do topo e "Meus times" mostram nome e escudo.
      await this.sessao.carregarMeusTimes();
    });
  }
}
