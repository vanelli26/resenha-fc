import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Copy } from '@primeicons/angular/copy';
import { Whatsapp } from '@primeicons/angular/whatsapp';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import {
  Escalacao,
  FORMACOES_POR_ESPORTE,
  MAX_NOME_TIME_ESCALACAO,
  NOMES_TIMES_PADRAO,
  chaveDaVaga,
  escalacaoAberta,
  ocupacaoDaEscalacao,
  vagaDaChave,
} from '../../models/escalacao.model';
import { Evento, Presenca, TIPOS_EVENTO_ABERTOS } from '../../models/evento.model';
import { Avisos, confirmacaoPadrao } from '../../shared/avisos';
import { abrirWhatsApp, copiarTexto } from '../../shared/compartilhar';
import { Voltar } from '../../shared/voltar';
import { EventosService, participa } from '../agenda/data/eventos.service';
import { ListaPessoas } from '../agenda/lista-pessoas';
import { ordenarPorNome } from '../agenda/lista-presenca';
import { AtletasService } from '../elenco/data/atletas.service';
import { VagaCampinho } from './campinho';
import { Campinhos, TimeEscalado, VagaTocada, timesDaEscalacao } from './campinhos';
import { EscalacaoService } from './data/escalacao.service';
import { jogadoresNaFormacao } from './formacoes';

interface GrupoCandidatos {
  titulo: string;
  pessoas: ComId<Atleta>[];
}

/**
 * Escalação do evento (DIRETRIZES 2.9): formação do esporte + vagas no campinho, um time ou dois (jogo entre nós),
 * em tempo real. Todos veem; a diretoria monta tocando nas vagas e fecha/abre; aberta, quem disse "Vou" toca numa
 * vaga livre para jogar nela.
 * Reservas = quem vai (ou foi, se realizado) e não está no campinho.
 */
@Component({
  selector: 'app-escalacao-page',
  imports: [
    FormsModule,
    Copy,
    Whatsapp,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    SelectButtonModule,
    SkeletonModule,
    Campinhos,
    ListaPessoas,
    Voltar,
  ],
  providers: [ConfirmationService],
  templateUrl: './escalacao-page.html',
  styleUrl: './escalacao-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscalacaoPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly eventosService = inject(EventosService);
  private readonly atletasService = inject(AtletasService);
  private readonly service = inject(EscalacaoService);
  private readonly avisos = inject(Avisos);
  private readonly confirmacao = inject(ConfirmationService);

  readonly eventoId = input.required<string>();

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly evento = signal<ComId<Evento> | null>(null);
  protected readonly naoEncontrado = signal(false);
  /** Primeira leitura da escalação chegou (evita piscar "não montada"). */
  protected readonly carregada = signal(false);
  private readonly cadastros = signal<ComId<Atleta>[]>([]);
  private readonly presencas = signal<ComId<Presenca>[]>([]);
  protected readonly salva = signal<Escalacao | null>(null);
  protected readonly salvando = signal(false);
  protected readonly limpando = signal(false);
  /** Jogador gravando a própria vaga (campinho bloqueado até terminar). */
  protected readonly escolhendoVaga = signal(false);
  /** Diretoria fechando/abrindo para os jogadores. */
  protected readonly alternandoFechada = signal(false);
  protected readonly aberta = computed(() => escalacaoAberta(this.salva()));

  // Edição (diretoria): formação, times e chave da vaga → atletaId, gravados só ao salvar.
  protected readonly editando = signal(false);
  protected readonly formacaoEmEdicao = signal('');
  /** Dois times: nomes; null = um time. */
  protected readonly nomesEmEdicao = signal<[string, string] | null>(null);
  private readonly ocupantes = signal<ReadonlyMap<string, string>>(new Map());
  /** Chave da vaga com o seletor de atleta aberto. */
  protected readonly vagaEscolhendo = signal<string | null>(null);
  protected readonly maxNome = MAX_NOME_TIME_ESCALACAO;
  protected readonly opcoesTimes = [
    { label: '1 time', value: false },
    { label: '2 times', value: true },
  ];

  protected readonly caminhoEvento = computed(() => `agenda/${this.eventoId()}`);
  protected readonly permiteEscalacao = computed(() => {
    const e = this.evento();
    return !!e && !TIPOS_EVENTO_ABERTOS.includes(e.tipo);
  });
  protected readonly opcoesFormacao = computed(() => {
    const e = this.evento();
    return (e ? FORMACOES_POR_ESPORTE[e.esporte] : []).map((f) => ({ label: f, value: f }));
  });
  private readonly meuAtletaId = computed(() => this.timeAtual.acesso()?.atletaId ?? null);
  /** Sem adversário = jogo entre nós: escalação nova começa com dois times. */
  private readonly semAdversario = computed(() => !this.evento()?.adversario?.trim());

  /** Jogador confirmado (disse Vou), evento agendado e escalação aberta: escolhe a própria vaga. */
  protected readonly podeSeEscalar = computed(() => {
    const e = this.evento();
    const eu = this.meuAtletaId();
    return (
      !!e &&
      !!eu &&
      this.permiteEscalacao() &&
      e.status === 'agendado' &&
      !this.editando() &&
      this.aberta() &&
      this.presencas().some((p) => p.id === eu && p.resposta === 'vou')
    );
  });

  /** Sem escalação salva, o jogador começa na formação padrão do esporte. */
  protected readonly formacao = computed(() => {
    if (this.editando()) return this.formacaoEmEdicao();
    const e = this.evento();
    return this.salva()?.formacao ?? (e && this.podeSeEscalar() ? FORMACOES_POR_ESPORTE[e.esporte][0] : '');
  });

  /** Nomes dos dois times em exibição (null = um time). Sem escalação salva, segue o padrão do evento. */
  private readonly nomes = computed<readonly [string, string] | null>(() => {
    if (this.editando()) return this.nomesEmEdicao();
    const salva = this.salva();
    if (salva) return salva.nomes ?? null;
    return this.semAdversario() ? NOMES_TIMES_PADRAO : null;
  });

  private readonly porId = computed(() => new Map(this.cadastros().map((a) => [a.id, a])));
  /** Chave da vaga → atletaId em exibição (rascunho na edição; gravado fora dela). */
  private readonly ocupacao = computed<ReadonlyMap<string, string>>(() =>
    this.editando() ? this.ocupantes() : ocupacaoDaEscalacao(this.salva()),
  );

  protected readonly times = computed<TimeEscalado[]>(() =>
    timesDaEscalacao(this.formacao(), this.ocupacao(), this.nomes(), this.porId()),
  );

  /** Quem vai: realizado = compareceu; senão, respondeu "Vou". */
  private readonly idsVao = computed(() => {
    const realizado = this.evento()?.status === 'realizado';
    return new Set(
      this.presencas()
        .filter((p) => (realizado ? p.compareceu : p.resposta === 'vou'))
        .map((p) => p.id),
    );
  });

  protected readonly reservas = computed(() => {
    const noCampo = new Set(this.ocupacao().values());
    return ordenarPorNome(this.cadastros().filter((a) => this.idsVao().has(a.id) && !noCampo.has(a.id)));
  });

  /** Para a vaga: quem vai primeiro, depois talvez, depois o resto do elenco que participa. */
  protected readonly candidatos = computed<GrupoCandidatos[]>(() => {
    const e = this.evento();
    if (!e) return [];
    const vao = this.idsVao();
    const talvez = new Set(this.presencas().filter((p) => p.resposta === 'talvez').map((p) => p.id));
    const elenco = this.cadastros().filter((a) => participa(e.tipo, a) || vao.has(a.id));
    return [
      { titulo: 'Vão', pessoas: ordenarPorNome(elenco.filter((a) => vao.has(a.id))) },
      { titulo: 'Talvez', pessoas: ordenarPorNome(elenco.filter((a) => !vao.has(a.id) && talvez.has(a.id))) },
      { titulo: 'Resto do elenco', pessoas: ordenarPorNome(elenco.filter((a) => !vao.has(a.id) && !talvez.has(a.id))) },
    ].filter((g) => g.pessoas.length > 0);
  });

  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const eventoId = this.eventoId();
      untracked(() => {
        this.pararDeOuvir?.();
        this.pararDeOuvir = null;
        this.evento.set(null);
        this.salva.set(null);
        this.carregada.set(false);
        this.editando.set(false);
        this.naoEncontrado.set(false);
        if (timeId) void this.carregar(timeId, eventoId);
      });
    });
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
  }

  protected editar(): void {
    const e = this.evento();
    if (!e) return;
    const salva = this.salva();
    this.formacaoEmEdicao.set(salva?.formacao ?? FORMACOES_POR_ESPORTE[e.esporte][0]);
    const nomes = this.nomes();
    this.nomesEmEdicao.set(nomes ? [nomes[0], nomes[1]] : null);
    this.ocupantes.set(ocupacaoDaEscalacao(salva));
    this.editando.set(true);
  }

  /** Troca de formação: mantém quem cabe (pelo número da vaga); os demais viram reservas. */
  protected trocarFormacao(formacao: string): void {
    const total = jogadoresNaFormacao(formacao);
    this.formacaoEmEdicao.set(formacao);
    this.ocupantes.update((atual) => new Map([...atual].filter(([chave]) => vagaDaChave(chave).vaga < total)));
  }

  /** Um time ↔ dois times. Voltar a um time manda o segundo para os reservas. */
  protected definirDoisTimes(dois: boolean): void {
    this.nomesEmEdicao.set(dois ? [...NOMES_TIMES_PADRAO] : null);
    if (!dois) this.ocupantes.update((atual) => new Map([...atual].filter(([chave]) => vagaDaChave(chave).lado === 'a')));
  }

  protected renomear(indice: 0 | 1, nome: string): void {
    this.nomesEmEdicao.update((n) => {
      if (!n) return n;
      const novo: [string, string] = [n[0], n[1]];
      novo[indice] = nome;
      return novo;
    });
  }

  protected escolher(atletaId: string | null): void {
    const vaga = this.vagaEscolhendo();
    if (vaga === null) return;
    this.ocupantes.update((atual) => {
      const novo = new Map(atual);
      const anterior = novo.get(vaga);
      // Atleta que já estava em outra vaga troca de lugar com quem estava nesta.
      const origem = atletaId ? [...novo].find(([, id]) => id === atletaId)?.[0] : undefined;
      if (origem !== undefined) {
        if (anterior) novo.set(origem, anterior);
        else novo.delete(origem);
      }
      if (atletaId) novo.set(vaga, atletaId);
      else novo.delete(vaga);
      return novo;
    });
    this.vagaEscolhendo.set(null);
  }

  protected async salvar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.auth.usuario()?.uid;
    const e = this.evento();
    if (!timeId || !uid || !e) return;
    const n = this.nomesEmEdicao();
    const nomes: [string, string] | null = n ? [n[0].trim(), n[1].trim()] : null;
    if (nomes && (!nomes[0] || !nomes[1])) {
      this.avisos.atencao('Dê um nome para cada time.');
      return;
    }
    // Mantém fechada se já estava; escalação nova ou do formato antigo fica aberta para os jogadores.
    const dados = { formacao: this.formacaoEmEdicao(), ocupacao: this.ocupantes(), fechada: !this.aberta(), nomes };
    const ok = await this.avisos.executar(
      this.salvando,
      () => this.service.salvar(timeId, e.id, dados, uid),
      'Escalação salva',
      'Não foi possível salvar',
    );
    // O listener traz a versão gravada.
    if (ok) this.editando.set(false);
  }

  /** Campinho: na edição (diretoria) abre o seletor; fora dela, o jogador entra na vaga livre ou sai da sua. */
  protected tocarVaga(tocada: VagaTocada): void {
    const vaga = chaveDaVaga(tocada.lado, tocada.vaga);
    if (this.editando()) {
      this.vagaEscolhendo.set(vaga);
      return;
    }
    const eu = this.meuAtletaId();
    if (!this.podeSeEscalar() || !eu) return;
    const ocupante = this.ocupacao().get(vaga);
    if (ocupante && ocupante !== eu) {
      this.avisos.atencao('Essa vaga já tem dono. Escolha uma livre.', 'Vaga ocupada');
      return;
    }
    void this.escolherVaga(ocupante === eu ? null : vaga);
  }

  protected async alternarFechada(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.auth.usuario()?.uid;
    const e = this.evento();
    if (!timeId || !uid || !e) return;
    const fechar = this.aberta();
    await this.avisos.executar(
      this.alternandoFechada,
      () => this.service.definirFechada(timeId, e.id, fechar, uid),
      fechar ? 'Escalação fechada' : 'Escalação aberta para quem vai',
    );
  }

  private async escolherVaga(vaga: string | null): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.auth.usuario()?.uid;
    const e = this.evento();
    const eu = this.meuAtletaId();
    if (!timeId || !uid || !e || !eu) return;
    await this.avisos.executar(
      this.escolhendoVaga,
      () => this.service.escolherVaga(timeId, e.id, { esporte: e.esporte, doisTimes: this.semAdversario() }, eu, vaga, uid),
      null,
      'Não foi possível escolher a vaga',
    );
  }

  protected limpar(): void {
    const timeId = this.timeAtual.timeId();
    const e = this.evento();
    if (!timeId || !e) return;
    this.confirmacao.confirm(
      confirmacaoPadrao({
        titulo: 'Limpar escalação',
        mensagem: 'Apagar a escalação deste evento?',
        rotulo: 'Limpar',
        aoConfirmar: async () => {
          const ok = await this.avisos.executar(this.limpando, () => this.service.limpar(timeId, e.id), 'Escalação apagada');
          if (ok) this.editando.set(false);
        },
      }),
    );
  }

  /** Texto para o grupo do time (negrito no formato do WhatsApp). */
  private readonly texto = computed(() => {
    const e = this.evento();
    if (!e) return '';
    const nome = (v: VagaCampinho) => (v.atleta ? v.atleta.apelido || v.atleta.nome : '—');
    const vagas = this.times().flatMap((t) => t.vagas);
    const linhas = ['Goleiro', 'Defesa', 'Meio', 'Ataque'].flatMap((rotulo) => {
      const nomes = vagas.filter((v) => v.rotulo === rotulo).map(nome);
      return nomes.length ? [`${rotulo === 'Goleiro' ? '🧤 ' : ''}${rotulo}: ${nomes.join(', ')}`] : [];
    });
    const reservas = this.reservas().map((a) => a.apelido || a.nome);
    return [
      `⚽ *Escalação · ${e.titulo}* (${this.formacao()})`,
      ...linhas,
      ...(reservas.length ? [`Reservas: ${reservas.join(', ')}`] : []),
    ].join('\n');
  });

  protected enviarWhatsApp(): void {
    abrirWhatsApp(this.texto());
  }

  protected async copiar(): Promise<void> {
    if (await copiarTexto(this.texto())) this.avisos.sucesso('Escalação copiada', 'Cole no grupo do time.');
    else this.avisos.info('Não foi possível copiar', this.texto(), 10000);
  }

  private async carregar(timeId: string, eventoId: string): Promise<void> {
    try {
      const [evento, cadastros, presencas] = await Promise.all([
        this.eventosService.obter(timeId, eventoId),
        this.atletasService.listar(timeId),
        this.eventosService.listarPresencas(timeId, eventoId),
      ]);
      if (this.timeAtual.timeId() !== timeId || this.eventoId() !== eventoId) return;
      if (!evento) {
        this.naoEncontrado.set(true);
        return;
      }
      this.evento.set(evento);
      this.cadastros.set(cadastros);
      this.presencas.set(presencas);
      // Tempo real: jogadores e diretoria montando ao mesmo tempo.
      this.pararDeOuvir = this.service.ouvir(
        timeId,
        eventoId,
        (escalacao) => {
          this.salva.set(escalacao);
          this.carregada.set(true);
        },
        (err) => this.avisos.erro('Erro ao carregar a escalação', err),
      );
    } catch (e) {
      this.avisos.erro('Erro ao carregar a escalação', e);
    }
  }
}
