import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, hidden, required, submit } from '@angular/forms/signals';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta, TipoVinculo, VINCULOS } from '../../models/atleta.model';
import { Solicitacao } from '../../models/convite.model';
import { Modalidade } from '../../models/modalidade.model';
import { mensagemDeErro } from '../../shared/erros';
import { Voltar } from '../../shared/voltar';
import { ROTULO_VINCULO, opcoes } from '../../shared/rotulos';
import { AtletasService, VinculoAtleta } from '../elenco/data/atletas.service';
import { SolicitacoesService } from './data/solicitacoes.service';

interface FormAprovacao {
  tipo: VinculoAtleta['tipo'];
  atletaId: string;
  modalidade: Modalidade;
  vinculo: TipoVinculo;
}

@Component({
  selector: 'app-solicitacoes-page',
  imports: [DatePipe, FormField, ButtonModule, DialogModule, RadioButtonModule, SelectModule, SkeletonModule, Voltar],
  templateUrl: './solicitacoes-page.html',
  styleUrl: './solicitacoes-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitacoesPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly solicitacoesService = inject(SolicitacoesService);
  private readonly atletasService = inject(AtletasService);
  private readonly mensagens = inject(MessageService);

  protected readonly pendentes = signal<ComId<Solicitacao>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly processando = signal(false);
  protected readonly opcoesVinculo = opcoes(VINCULOS, ROTULO_VINCULO);
  protected readonly opcoesModalidade = this.timeAtual.opcoesModalidade;

  // Atletas ainda sem conta vinculada, para "vincular a atleta existente".
  private readonly atletasSemConta = signal<ComId<Atleta>[]>([]);
  protected readonly opcoesAtleta = computed(() =>
    this.atletasSemConta().map((a) => ({ label: a.apelido ? `${a.apelido} (${a.nome})` : a.nome, value: a.id })),
  );

  protected readonly emAprovacao = signal<ComId<Solicitacao> | null>(null);
  protected readonly dialogAberto = signal(false);
  protected readonly modelo = signal<FormAprovacao>({ tipo: 'novo', atletaId: '', modalidade: 'isento', vinculo: 'atleta' });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.atletaId, {
      message: 'Escolha o cadastro.',
      when: ({ valueOf }) => valueOf(p.tipo) === 'existente',
    });
    hidden(p.atletaId, { when: ({ valueOf }) => valueOf(p.tipo) !== 'existente' });
    hidden(p.modalidade, { when: ({ valueOf }) => valueOf(p.tipo) !== 'novo' });
    hidden(p.vinculo, { when: ({ valueOf }) => valueOf(p.tipo) !== 'novo' });
  });

  constructor() {
    // A tela é reaproveitada ao trocar de time (/t/A → /t/B): recarrega sempre que o time muda.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.pendentes.set([]);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar();
      });
    });
  }

  protected async abrirAprovacao(solicitacao: ComId<Solicitacao>): Promise<void> {
    this.emAprovacao.set(solicitacao);
    const modalidade = this.timeAtual.modalidadePadrao();
    this.modelo.set({ tipo: 'novo', atletaId: '', modalidade, vinculo: 'atleta' });
    this.dialogAberto.set(true);
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    try {
      const atletas = await this.atletasService.listar(timeId);
      this.atletasSemConta.set(atletas.filter((a) => a.uid === null && a.status !== 'inativo'));
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar atletas', detail: mensagemDeErro(e) });
    }
  }

  protected aprovar(): void {
    void submit(this.formulario, async () => {
      const time = this.timeAtual.time();
      const solicitacao = this.emAprovacao();
      const uid = this.auth.usuario()?.uid;
      if (!time || !solicitacao || !uid) return;
      const f = this.modelo();
      const vinculo: VinculoAtleta =
        f.tipo === 'existente'
          ? { tipo: f.tipo, atletaId: f.atletaId }
          : { tipo: f.tipo, modalidade: f.modalidade, vinculo: f.vinculo };
      await this.executar(
        () => this.solicitacoesService.aprovar(time, solicitacao, vinculo, uid),
        `${solicitacao.nome} agora faz parte do time`,
      );
      this.dialogAberto.set(false);
    });
  }

  protected async recusar(solicitacao: ComId<Solicitacao>): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    await this.executar(() => this.solicitacoesService.recusar(timeId, solicitacao.id), 'Solicitação recusada');
  }

  private async executar(acao: () => Promise<void>, sucesso: string): Promise<void> {
    this.processando.set(true);
    try {
      await acao();
      this.mensagens.add({ severity: 'success', summary: sucesso });
      await this.carregar();
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível concluir', detail: mensagemDeErro(e) });
    } finally {
      this.processando.set(false);
    }
  }

  private async carregar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.carregando.set(true);
    try {
      const dados = await this.solicitacoesService.listarPendentes(timeId);
      // Descarta resposta atrasada de um time anterior.
      if (this.timeAtual.timeId() === timeId) this.pendentes.set(dados);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar solicitações', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }
}
