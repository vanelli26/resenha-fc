import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ComId } from '../../core/firebase/conversor';
import { AuthService } from '../../core/auth/auth.service';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { mensagemDeErro } from '../../shared/erros';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { ROTULO_MODALIDADE, ROTULO_POSICAO, ROTULO_STATUS_ATLETA } from '../../shared/rotulos';
import { AtletaForm } from './atleta-form';
import { AtletasService, DadosAtleta } from './data/atletas.service';

@Component({
  selector: 'app-elenco-page',
  imports: [ButtonModule, DialogModule, SkeletonModule, TagModule, AtletaForm, FotoPessoa],
  templateUrl: './elenco-page.html',
  styleUrl: './elenco-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElencoPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly atletasService = inject(AtletasService);
  private readonly mensagens = inject(MessageService);

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly modalidades = this.timeAtual.modalidadesHabilitadas;
  /** Atleta vinculado à conta logada neste time (null se não estiver no elenco). */
  protected readonly meuAtletaId = computed(() => this.timeAtual.acesso()?.atletaId ?? null);
  protected readonly atletas = signal<ComId<Atleta>[]>([]);
  /** Elenco em atividade (ativos e afastados). */
  protected readonly elenco = computed(() => this.atletas().filter((a) => a.status !== 'inativo'));
  /** Quem saiu do time: só a diretoria vê, para consultar ou reativar. */
  protected readonly inativos = computed(() => this.atletas().filter((a) => a.status === 'inativo'));
  protected readonly mostrarInativos = signal(false);
  protected readonly visiveis = computed(() =>
    this.mostrarInativos() && this.ehDiretoria() ? [...this.elenco(), ...this.inativos()] : this.elenco(),
  );
  protected readonly carregando = signal(true);
  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<ComId<Atleta> | null>(null);
  /** Jogador (sem diretoria) editando o próprio atleta. */
  protected readonly modoForm = computed(() => (this.ehDiretoria() ? 'completo' : 'proprio'));
  protected readonly tituloDialog = computed(() => {
    if (!this.emEdicao()) return 'Novo atleta';
    return this.modoForm() === 'proprio' ? 'Meus dados' : 'Editar atleta';
  });

  protected readonly rotuloModalidade = ROTULO_MODALIDADE;
  protected readonly rotuloPosicao = ROTULO_POSICAO;
  protected readonly rotuloStatus = ROTULO_STATUS_ATLETA;

  constructor() {
    // A tela é reaproveitada ao trocar de time (/t/A → /t/B): recarrega sempre que o time muda.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.atletas.set([]);
        this.dialogAberto.set(false);
        this.mostrarInativos.set(false);
        if (timeId) void this.carregar();
      });
    });
  }

  protected abrir(atleta: ComId<Atleta> | null): void {
    this.emEdicao.set(atleta);
    this.dialogAberto.set(true);
  }

  protected async salvar(dados: DadosAtleta): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    const atleta = this.emEdicao();
    try {
      if (atleta && this.modoForm() === 'proprio') {
        await this.atletasService.atualizarProprio(timeId, atleta.id, dados);
      } else if (atleta) {
        await this.atletasService.atualizar(timeId, atleta.id, dados);
      } else {
        await this.atletasService.criar(timeId, dados);
      }
      this.dialogAberto.set(false);
      this.mensagens.add({ severity: 'success', summary: atleta ? 'Atleta atualizado' : 'Atleta cadastrado' });
      await this.carregar();
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível salvar', detail: mensagemDeErro(e) });
    }
  }

  private async carregar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.carregando.set(true);
    try {
      const dados = await this.atletasService.listar(timeId);
      // Descarta resposta atrasada de um time anterior.
      if (this.timeAtual.timeId() === timeId) this.atletas.set(dados);
      void this.sincronizarMinhaFoto(timeId);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar o elenco', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }

  /**
   * Copia a foto do Google da conta logada para o próprio atleta (só grava se mudou).
   * A diretoria não lê usuarios/{uid}; por isso quem sincroniza é o próprio jogador.
   */
  private async sincronizarMinhaFoto(timeId: string): Promise<void> {
    const atletaId = this.meuAtletaId();
    const foto = this.auth.usuario()?.fotoUrl ?? null;
    const meu = this.atletas().find((a) => a.id === atletaId);
    if (!atletaId || !meu || (meu.fotoUrl ?? null) === foto) return;
    try {
      await this.atletasService.atualizarFoto(timeId, atletaId, foto);
      this.atletas.update((lista) =>
        lista.map((a) => (a.id === atletaId ? { ...a, fotoUrl: foto ?? undefined } : a)),
      );
    } catch {
      // Sincronização é conveniência: falha silenciosa, tenta de novo na próxima abertura.
    }
  }
}
