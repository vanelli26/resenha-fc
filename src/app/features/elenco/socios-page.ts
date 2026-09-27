import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService, nomeDaModalidade } from '../../core/time/time-atual.service';
import { Atleta, vinculoDe } from '../../models/atleta.model';
import { mensagemDeErro } from '../../shared/erros';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { ROTULO_STATUS_ATLETA, ROTULO_VINCULO } from '../../shared/rotulos';
import { Voltar } from '../../shared/voltar';
import { AtletaForm } from './atleta-form';
import { AtletasService, DadosAtleta } from './data/atletas.service';

/** Sócios e colaboradores/torcedores: quem não joga. Entram por convite; aqui a diretoria só edita. */
@Component({
  selector: 'app-socios-page',
  imports: [ButtonModule, DialogModule, SkeletonModule, TagModule, AtletaForm, FotoPessoa, Voltar],
  templateUrl: './socios-page.html',
  styleUrls: ['./elenco-page.scss', './socios-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SociosPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly atletasService = inject(AtletasService);
  private readonly mensagens = inject(MessageService);

  protected readonly opcoesModalidade = this.timeAtual.opcoesModalidade;
  protected readonly modalidadePadrao = this.timeAtual.modalidadePadrao;
  /** Nome do plano (ou Isento) de cada cadastro. */
  protected readonly nomeModalidade = computed(() => {
    const nomes = this.timeAtual.nomesModalidade();
    return (modalidade: string) => nomeDaModalidade(nomes, modalidade);
  });
  protected readonly esportes = this.timeAtual.esportes;

  private readonly cadastros = signal<ComId<Atleta>[]>([]);
  /** Sócios e colaboradores; inativos por último. */
  protected readonly pessoas = computed(() =>
    this.cadastros()
      .filter((a) => vinculoDe(a) !== 'atleta')
      .map((a) => ({ ...a, rotuloVinculo: ROTULO_VINCULO[vinculoDe(a)] }))
      .sort((a, b) => Number(a.status === 'inativo') - Number(b.status === 'inativo')),
  );
  protected readonly carregando = signal(true);
  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<ComId<Atleta> | null>(null);

  protected readonly rotuloStatus = ROTULO_STATUS_ATLETA;

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.cadastros.set([]);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar(timeId);
      });
    });
  }

  protected editar(pessoa: ComId<Atleta>): void {
    this.emEdicao.set(pessoa);
    this.dialogAberto.set(true);
  }

  protected async salvar(dados: DadosAtleta): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    const atual = this.emEdicao();
    try {
      if (!atual) return;
      await this.atletasService.atualizar(timeId, atual.id, dados);
      this.dialogAberto.set(false);
      this.mensagens.add({ severity: 'success', summary: 'Cadastro atualizado' });
      await this.carregar(timeId);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível salvar', detail: mensagemDeErro(e) });
    }
  }

  private async carregar(timeId: string): Promise<void> {
    this.carregando.set(true);
    try {
      const dados = await this.atletasService.listar(timeId);
      if (this.timeAtual.timeId() === timeId) this.cadastros.set(dados);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar o cadastro', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }
}
