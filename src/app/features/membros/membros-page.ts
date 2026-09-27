import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, hidden, required, submit } from '@angular/forms/signals';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { UsuariosService } from '../../core/auth/usuarios.service';
import { ComId } from '../../core/firebase/conversor';
import { SessaoService } from '../../core/sessao/sessao.service';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Acesso } from '../../models/acesso.model';
import { Atleta } from '../../models/atleta.model';
import { Modalidade } from '../../models/modalidade.model';
import { PAPEIS_TIME, PapelTime } from '../../models/papel.model';
import { mensagemDeErro } from '../../shared/erros';
import { Voltar } from '../../shared/voltar';
import { ROTULO_MODALIDADE, ROTULO_PAPEL, opcoes } from '../../shared/rotulos';
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
}

interface OpcaoUsuario {
  label: string;
  value: string;
  nome: string;
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
  private readonly usuariosService = inject(UsuariosService);
  private readonly mensagens = inject(MessageService);

  protected readonly papeisTime = PAPEIS_TIME;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  protected readonly opcoesModalidade = computed(() => opcoes(this.timeAtual.modalidadesHabilitadas(), ROTULO_MODALIDADE));
  protected readonly adminGeral = this.sessao.adminGeral;

  protected readonly membros = signal<ComId<Acesso>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly qtdDiretoria = computed(
    () => this.membros().filter((m) => m.papeis.includes('diretoria')).length,
  );

  // Diálogo de edição (membro existente) ou inclusão (adminGeral, uid escolhido na lista de usuários).
  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<ComId<Acesso> | null>(null);
  protected readonly tituloDialog = computed(() => this.emEdicao()?.nome ?? 'Adicionar membro');
  protected readonly usuarios = signal<OpcaoUsuario[]>([]);
  private readonly atletas = signal<ComId<Atleta>[]>([]);

  /** Atletas sem conta + o atleta já vinculado a este membro. */
  protected readonly opcoesAtleta = computed(() => {
    const uidMembro = this.modelo().uid;
    const disponiveis = this.atletas().filter(
      (a) => (a.uid === null && a.status !== 'inativo') || (uidMembro !== '' && a.uid === uidMembro),
    );
    return [
      { label: 'Não está no elenco', value: SEM_ATLETA },
      { label: 'Criar novo atleta', value: NOVO_ATLETA },
      ...disponiveis.map((a) => ({ label: nomeAtleta(a), value: a.id })),
    ];
  });

  protected readonly modelo = signal<FormMembro>({
    uid: '',
    papeis: { ...SEM_PAPEIS },
    atleta: SEM_ATLETA,
    modalidade: 'isento',
  });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.uid, { message: 'Escolha um usuário.' });
    hidden(p.modalidade, { when: ({ valueOf }) => valueOf(p.atleta) !== NOVO_ATLETA });
  });

  constructor() {
    // A tela é reaproveitada ao trocar de time (/t/A → /t/B): recarrega sempre que o time muda.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.membros.set([]);
        this.usuarios.set([]);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar();
      });
    });
  }

  protected editar(membro: ComId<Acesso>): void {
    const papeis = { ...SEM_PAPEIS };
    for (const p of membro.papeis) papeis[p] = true;
    this.emEdicao.set(membro);
    this.modelo.set({ uid: membro.uid, papeis, atleta: membro.atletaId ?? SEM_ATLETA, modalidade: this.modalidadePadrao() });
    this.abrirDialog();
  }

  protected async adicionar(): Promise<void> {
    this.emEdicao.set(null);
    this.modelo.set({ uid: '', papeis: { ...SEM_PAPEIS, diretoria: true }, atleta: SEM_ATLETA, modalidade: this.modalidadePadrao() });
    this.abrirDialog();
    if (this.usuarios().length > 0) return;
    try {
      const doTime = new Set(this.membros().map((m) => m.uid));
      const lista = await this.usuariosService.listar();
      this.usuarios.set(
        lista
          .filter((u) => !doTime.has(u.id))
          .map((u) => ({ label: `${u.nome} (${u.email})`, value: u.id, nome: u.nome || u.email })),
      );
    } catch (e) {
      this.erro('Erro ao carregar usuários', e);
    }
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const time = this.timeAtual.time();
      const uidLogado = this.auth.usuario()?.uid;
      if (!time || !uidLogado) return;

      const { uid, atleta, modalidade } = this.modelo();
      const papeis = marcados(this.modelo().papeis);
      if (papeis.length === 0) {
        this.aviso('Marque ao menos um papel. Para tirar a pessoa do time, use "Remover do time".');
        return;
      }
      const membro = this.emEdicao();
      if (membro && this.tiraUltimaDiretoria(membro) && !papeis.includes('diretoria')) {
        this.aviso('O time precisa de ao menos uma pessoa na diretoria.');
        return;
      }

      const nome = membro?.nome ?? this.usuarios().find((u) => u.value === uid)?.nome ?? '';
      const vinculo: VinculoAtleta | null =
        atleta === SEM_ATLETA
          ? null
          : atleta === NOVO_ATLETA
            ? { tipo: 'novo', modalidade }
            : { tipo: 'existente', atletaId: atleta };

      await this.executar(async () => {
        await this.acessosService.salvar(
          time,
          { uid, nome, papeis, vinculo, atletaIdAnterior: membro?.atletaId ?? null },
          uidLogado,
        );
        if (!membro) this.usuarios.update((lista) => lista.filter((u) => u.value !== uid));
      }, membro ? 'Membro atualizado' : 'Membro adicionado');
    });
  }

  protected async remover(): Promise<void> {
    const time = this.timeAtual.time();
    const membro = this.emEdicao();
    if (!time || !membro) return;
    if (this.tiraUltimaDiretoria(membro)) {
      this.aviso('Não é possível remover a última pessoa da diretoria.');
      return;
    }
    await this.executar(() => this.acessosService.remover(time.id, membro), 'Membro removido');
  }

  /** Primeira modalidade habilitada no time (isento está sempre disponível). */
  private modalidadePadrao(): Modalidade {
    return this.timeAtual.modalidadesHabilitadas()[0] ?? 'isento';
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
      this.erro('Erro ao carregar o elenco', e);
    }
  }

  // Regra de UX (DIRETRIZES, seção 10): Rules não contam documentos; adminGeral corrige se preciso.
  private tiraUltimaDiretoria(membro: Acesso): boolean {
    return membro.papeis.includes('diretoria') && this.qtdDiretoria() <= 1;
  }

  private async executar(acao: () => Promise<void>, sucesso: string): Promise<void> {
    this.salvando.set(true);
    try {
      await acao();
      this.dialogAberto.set(false);
      this.mensagens.add({ severity: 'success', summary: sucesso });
      // Pode ter alterado os próprios papéis/vínculo: atualiza contexto e "Meus times".
      await Promise.all([this.carregar(), this.timeAtual.recarregarAcesso(), this.sessao.carregarMeusTimes()]);
    } catch (e) {
      this.erro('Não foi possível salvar', e);
    } finally {
      this.salvando.set(false);
    }
  }

  private aviso(detalhe: string): void {
    this.mensagens.add({ severity: 'warn', summary: 'Atenção', detail: detalhe });
  }

  private erro(resumo: string, e: unknown): void {
    this.mensagens.add({ severity: 'error', summary: resumo, detail: mensagemDeErro(e) });
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
      this.erro('Erro ao carregar membros', e);
    } finally {
      this.carregando.set(false);
    }
  }
}
