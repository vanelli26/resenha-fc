import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ComId } from '../../core/firebase/conversor';
import { AuthService } from '../../core/auth/auth.service';
import { TimeAtualService, nomeDaModalidade } from '../../core/time/time-atual.service';
import { Atleta, vinculoDe } from '../../models/atleta.model';
import { Avisos } from '../../shared/avisos';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { esportesComPosicao } from '../../models/posicao.model';
import {
  ROTULO_ESPORTE,
  ROTULO_POSICAO,
  ROTULO_STATUS_ATLETA,
  ROTULO_VINCULO,
} from '../../shared/rotulos';
import { AtletaForm } from './atleta-form';
import { AtletasService, DadosAtleta } from './data/atletas.service';
import { ElencoAbas } from './elenco-abas';

@Component({
  selector: 'app-elenco-page',
  imports: [ButtonModule, DialogModule, SkeletonModule, TagModule, AtletaForm, ElencoAbas, FotoPessoa],
  templateUrl: './elenco-page.html',
  styleUrl: './elenco-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElencoPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly atletasService = inject(AtletasService);
  private readonly avisos = inject(Avisos);

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly opcoesModalidade = this.timeAtual.opcoesModalidade;
  protected readonly modalidadePadrao = this.timeAtual.modalidadePadrao;
  /** Nome do plano (ou Isento) de cada cadastro. */
  protected readonly nomeModalidade = computed(() => {
    const nomes = this.timeAtual.nomesModalidade();
    return (modalidade: string) => nomeDaModalidade(nomes, modalidade);
  });
  protected readonly esportes = this.timeAtual.esportes;
  /** Atleta vinculado à conta logada neste time (null se não estiver no elenco). */
  protected readonly meuAtletaId = computed(() => this.timeAtual.acesso()?.atletaId ?? null);
  /** Todo o cadastro do time (atletas, sócios e colaboradores): uma leitura só, coleção pequena. */
  private readonly cadastros = signal<ComId<Atleta>[]>([]);
  /** Só quem joga; sócios e colaboradores ficam em Gestão. */
  protected readonly atletas = computed(() => this.cadastros().filter((a) => vinculoDe(a) === 'atleta'));
  /** Cadastro da conta logada quando não é atleta (sócio/colaborador), para "Meus dados". */
  protected readonly meuCadastroForaDoElenco = computed(() => {
    const id = this.meuAtletaId();
    const meu = this.cadastros().find((a) => a.id === id);
    const vinculo = meu ? vinculoDe(meu) : 'atleta';
    return meu && vinculo !== 'atleta' ? { cadastro: meu, rotulo: ROTULO_VINCULO[vinculo] } : null;
  });
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

  /** Posições por atleta, prontas para exibir ("Campo: Zagueiro, Volante · Futsal: Fixo"). */
  protected readonly textoPosicoes = computed(() => {
    const variosEsportes = this.esportes().length > 1;
    return new Map(
      this.atletas().map((a) => {
        const grupos = esportesComPosicao(a.posicoes).map((e) => {
          const nomes = (a.posicoes[e] ?? []).map((p) => ROTULO_POSICAO[p]).join(', ');
          return variosEsportes || e !== 'society' ? `${ROTULO_ESPORTE[e]}: ${nomes}` : nomes;
        });
        return [a.id, grupos.join(' · ')];
      }),
    );
  });

  protected readonly rotuloStatus = ROTULO_STATUS_ATLETA;

  constructor() {
    // A tela é reaproveitada ao trocar de time (/t/A → /t/B): recarrega sempre que o time muda.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.cadastros.set([]);
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
      this.avisos.sucesso(atleta ? 'Atleta atualizado' : 'Atleta cadastrado');
      await this.carregar();
    } catch (e) {
      this.avisos.erro('Não foi possível salvar', e);
    }
  }

  private async carregar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.carregando.set(true);
    try {
      const dados = await this.atletasService.listar(timeId);
      // Descarta resposta atrasada de um time anterior.
      if (this.timeAtual.timeId() === timeId) this.cadastros.set(dados);
      void this.sincronizarMinhaFoto(timeId);
    } catch (e) {
      this.avisos.erro('Erro ao carregar o elenco', e);
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
    const meu = this.cadastros().find((a) => a.id === atletaId);
    if (!atletaId || !meu || (meu.fotoUrl ?? null) === foto) return;
    try {
      await this.atletasService.atualizarFoto(timeId, atletaId, foto);
      this.cadastros.update((lista) =>
        lista.map((a) => (a.id === atletaId ? { ...a, fotoUrl: foto ?? undefined } : a)),
      );
    } catch {
      // Sincronização é conveniência: falha silenciosa, tenta de novo na próxima abertura.
    }
  }
}
