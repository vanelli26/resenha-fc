import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, hidden, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { SessaoService } from '../../core/sessao/sessao.service';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Acesso } from '../../models/acesso.model';
import { Atleta, TipoVinculo, VINCULOS } from '../../models/atleta.model';
import { Modalidade } from '../../models/modalidade.model';
import { PAPEIS_TIME, PapelTime } from '../../models/papel.model';
import { Avisos } from '../../shared/avisos';
import { Voltar } from '../../shared/voltar';
import { ROTULO_PAPEL, ROTULO_VINCULO, opcoes } from '../../shared/rotulos';
import { AtletasService, VinculoAtleta } from '../elenco/data/atletas.service';
import { AcessosService } from './data/acessos.service';

type MarcacaoPapeis = Record<PapelTime, boolean>;

// Valores especiais do campo "Atleta no elenco" (os demais são atletaIds).
const SEM_ATLETA = '';
const NOVO_ATLETA = '__novo__';

interface FormMembro {
  uid: string;
  papeis: MarcacaoPapeis;
  atleta: string;
  modalidade: Modalidade;
  vinculo: TipoVinculo;
}

const SEM_PAPEIS: MarcacaoPapeis = { diretoria: false, tesouraria: false, jogador: false };

function marcados(papeis: MarcacaoPapeis): PapelTime[] {
  return PAPEIS_TIME.filter((p) => papeis[p]);
}

function nomeAtleta(a: Atleta): string {
  return a.apelido ? `${a.apelido} (${a.nome})` : a.nome;
}

@Component({
  selector: 'app-membros-page',
  imports: [FormField, ButtonModule, CheckboxModule, DialogModule, SelectModule, SkeletonModule, TagModule, Voltar],
  templateUrl: './membros-page.html',
  styleUrl: './membros-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembrosPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly sessao = inject(SessaoService);
  private readonly auth = inject(AuthService);
  private readonly acessosService = inject(AcessosService);
  private readonly atletasService = inject(AtletasService);
  private readonly avisos = inject(Avisos);

  protected readonly papeisTime = PAPEIS_TIME;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  protected readonly opcoesModalidade = this.timeAtual.opcoesModalidade;
  protected readonly opcoesVinculo = opcoes(VINCULOS, ROTULO_VINCULO);

  protected readonly membros = signal<ComId<Acesso>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  /** Remoção em andamento (carregando no botão Remover; Salvar fica desabilitado). */
  protected readonly removendo = signal(false);
  protected readonly qtdDiretoria = computed(
    () => this.membros().filter((m) => m.papeis.includes('diretoria')).length,
  );

  // Diálogo de edição de um membro (novos membros entram por convite).
  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<ComId<Acesso> | null>(null);
  protected readonly tituloDialog = computed(() => this.emEdicao()?.nome ?? '');
  private readonly atletas = signal<ComId<Atleta>[]>([]);

  /** Atletas sem conta + o atleta já vinculado a este membro. */
  protected readonly opcoesAtleta = computed(() => {
    const uidMembro = this.modelo().uid;
    const disponiveis = this.atletas().filter(
      (a) => (a.uid === null && a.status !== 'inativo') || (uidMembro !== '' && a.uid === uidMembro),
    );
    return [
      { label: 'Sem cadastro no time', value: SEM_ATLETA },
      { label: 'Criar novo cadastro', value: NOVO_ATLETA },
      ...disponiveis.map((a) => ({ label: nomeAtleta(a), value: a.id })),
    ];
  });

  protected readonly modelo = signal<FormMembro>({
    uid: '',
    papeis: { ...SEM_PAPEIS },
    atleta: SEM_ATLETA,
    modalidade: 'isento',
    vinculo: 'atleta',
  });
  protected readonly formulario = form(this.modelo, (p) => {
    hidden(p.modalidade, { when: ({ valueOf }) => valueOf(p.atleta) !== NOVO_ATLETA });
    hidden(p.vinculo, { when: ({ valueOf }) => valueOf(p.atleta) !== NOVO_ATLETA });
  });

  constructor() {
    // A tela é reaproveitada ao trocar de time (/t/A → /t/B): recarrega sempre que o time muda.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.membros.set([]);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar();
      });
    });
  }

  protected editar(membro: ComId<Acesso>): void {
    const papeis = { ...SEM_PAPEIS };
    for (const p of membro.papeis) papeis[p] = true;
    this.emEdicao.set(membro);
    this.modelo.set({
      uid: membro.uid,
      papeis,
      atleta: membro.atletaId ?? SEM_ATLETA,
      modalidade: this.timeAtual.modalidadePadrao(),
      vinculo: 'atleta',
    });
    this.abrirDialog();
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const time = this.timeAtual.time();
      const uidLogado = this.auth.usuario()?.uid;
      if (!time || !uidLogado) return;

      const { uid, atleta, modalidade, vinculo: tipoVinculo } = this.modelo();
      const papeis = marcados(this.modelo().papeis);
      if (papeis.length === 0) {
        this.avisos.atencao('Marque ao menos um papel. Para tirar a pessoa do time, use "Remover do time".');
        return;
      }
      const membro = this.emEdicao();
      if (!membro) return;
      if (this.tiraUltimaDiretoria(membro) && !papeis.includes('diretoria')) {
        this.avisos.atencao('O time precisa de ao menos uma pessoa na diretoria.');
        return;
      }

      const nome = membro.nome;
      const vinculo: VinculoAtleta | null =
        atleta === SEM_ATLETA
          ? null
          : atleta === NOVO_ATLETA
            ? { tipo: 'novo', modalidade, vinculo: tipoVinculo }
            : { tipo: 'existente', atletaId: atleta };

      await this.executar(
        () =>
          this.acessosService.salvar(time, { uid, nome, papeis, vinculo, atletaIdAnterior: membro.atletaId }, uidLogado),
        'Membro atualizado',
      );
    });
  }

  protected async remover(): Promise<void> {
    const time = this.timeAtual.time();
    const membro = this.emEdicao();
    if (!time || !membro) return;
    if (this.tiraUltimaDiretoria(membro)) {
      this.avisos.atencao('Não é possível remover a última pessoa da diretoria.');
      return;
    }
    await this.executar(() => this.acessosService.remover(time.id, membro), 'Membro removido', this.removendo);
  }

  private abrirDialog(): void {
    this.dialogAberto.set(true);
    void this.carregarAtletas();
  }

  private async carregarAtletas(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    try {
      const dados = await this.atletasService.listar(timeId);
      if (this.timeAtual.timeId() === timeId) this.atletas.set(dados);
    } catch (e) {
      this.avisos.erro('Erro ao carregar o elenco', e);
    }
  }

  // Regra de UX (DIRETRIZES, seção 10): Rules não contam documentos.
  private tiraUltimaDiretoria(membro: Acesso): boolean {
    return membro.papeis.includes('diretoria') && this.qtdDiretoria() <= 1;
  }

  /** Após salvar/remover: fecha o diálogo e recarrega (pode ter alterado os próprios papéis/vínculo: contexto e "Meus times"). */
  private async executar(acao: () => Promise<void>, sucesso: string, ocupado = this.salvando): Promise<void> {
    if (!(await this.avisos.executar(ocupado, acao, sucesso, 'Não foi possível salvar'))) return;
    this.dialogAberto.set(false);
    await Promise.all([this.carregar(), this.timeAtual.recarregarAcesso(), this.sessao.carregarMeusTimes()]);
  }

  private async carregar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.carregando.set(true);
    try {
      const dados = await this.acessosService.listar(timeId);
      // Descarta resposta atrasada de um time anterior.
      if (this.timeAtual.timeId() === timeId) this.membros.set(dados);
    } catch (e) {
      this.avisos.erro('Erro ao carregar membros', e);
    } finally {
      this.carregando.set(false);
    }
  }
}
