import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Copy } from '@primeicons/angular/copy';
import { Whatsapp } from '@primeicons/angular/whatsapp';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { Escalacao, FORMACOES_POR_ESPORTE } from '../../models/escalacao.model';
import { Evento, Presenca, TIPOS_EVENTO_ABERTOS } from '../../models/evento.model';
import { Avisos, confirmacaoPadrao } from '../../shared/avisos';
import { abrirWhatsApp, copiarTexto } from '../../shared/compartilhar';
import { Voltar } from '../../shared/voltar';
import { EventosService, participa } from '../agenda/data/eventos.service';
import { ListaPessoas } from '../agenda/lista-pessoas';
import { ordenarPorNome } from '../agenda/lista-presenca';
import { AtletasService } from '../elenco/data/atletas.service';
import { Campinho, VagaCampinho } from './campinho';
import { EscalacaoService } from './data/escalacao.service';
import { jogadoresNaFormacao, vagasDaFormacao } from './formacoes';

interface GrupoCandidatos {
  titulo: string;
  pessoas: ComId<Atleta>[];
}

/**
 * Escalação do evento (DIRETRIZES 2.9): formação do esporte + vagas no campinho. Todos veem; a diretoria monta
 * tocando nas vagas. Reservas = quem vai (ou foi, se realizado) e não está no campinho.
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
    SelectButtonModule,
    SkeletonModule,
    Campinho,
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
  private readonly cadastros = signal<ComId<Atleta>[]>([]);
  private readonly presencas = signal<ComId<Presenca>[]>([]);
  protected readonly salva = signal<Escalacao | null>(null);
  protected readonly salvando = signal(false);

  // Edição (diretoria): formação e vaga → atletaId, gravados só ao salvar.
  protected readonly editando = signal(false);
  protected readonly formacaoEmEdicao = signal('');
  private readonly ocupantes = signal<ReadonlyMap<number, string>>(new Map());
  /** Vaga com o seletor de atleta aberto. */
  protected readonly vagaEscolhendo = signal<number | null>(null);

  protected readonly caminhoEvento = computed(() => `agenda/${this.eventoId()}`);
  protected readonly permiteEscalacao = computed(() => {
    const e = this.evento();
    return !!e && !TIPOS_EVENTO_ABERTOS.includes(e.tipo);
  });
  protected readonly opcoesFormacao = computed(() => {
    const e = this.evento();
    return (e ? FORMACOES_POR_ESPORTE[e.esporte] : []).map((f) => ({ label: f, value: f }));
  });
  protected readonly formacao = computed(() => (this.editando() ? this.formacaoEmEdicao() : this.salva()?.formacao ?? ''));

  private readonly porId = computed(() => new Map(this.cadastros().map((a) => [a.id, a])));
  /** Vaga → atletaId em exibição (rascunho na edição; gravado fora dela). */
  private readonly ocupacao = computed<ReadonlyMap<number, string>>(() =>
    this.editando() ? this.ocupantes() : new Map((this.salva()?.titulares ?? []).map((t) => [t.vaga, t.atletaId])),
  );

  protected readonly vagas = computed<VagaCampinho[]>(() => {
    const f = this.formacao();
    if (!f) return [];
    const ocupacao = this.ocupacao();
    const porId = this.porId();
    return vagasDaFormacao(f).map((v) => ({ ...v, atleta: porId.get(ocupacao.get(v.indice) ?? '') ?? null }));
  });

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

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const eventoId = this.eventoId();
      untracked(() => {
        this.evento.set(null);
        this.salva.set(null);
        this.editando.set(false);
        this.naoEncontrado.set(false);
        if (timeId) void this.carregar(timeId, eventoId);
      });
    });
  }

  protected editar(): void {
    const e = this.evento();
    if (!e) return;
    const salva = this.salva();
    this.formacaoEmEdicao.set(salva?.formacao ?? FORMACOES_POR_ESPORTE[e.esporte][0]);
    this.ocupantes.set(new Map((salva?.titulares ?? []).map((t) => [t.vaga, t.atletaId])));
    this.editando.set(true);
  }

  /** Troca de formação: mantém quem cabe (pelo número da vaga); os demais viram reservas. */
  protected trocarFormacao(formacao: string): void {
    const total = jogadoresNaFormacao(formacao);
    this.formacaoEmEdicao.set(formacao);
    this.ocupantes.update((atual) => new Map([...atual].filter(([vaga]) => vaga < total)));
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
    const formacao = this.formacaoEmEdicao();
    const titulares = [...this.ocupantes()]
      .sort(([a], [b]) => a - b)
      .map(([vaga, atletaId]) => ({ atletaId, vaga }));
    const ok = await this.avisos.executar(
      this.salvando,
      () => this.service.salvar(timeId, e.id, formacao, titulares, uid),
      'Escalação salva',
      'Não foi possível salvar',
    );
    if (!ok) return;
    this.editando.set(false);
    this.salva.set(await this.service.obter(timeId, e.id));
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
          const ok = await this.avisos.executar(this.salvando, () => this.service.limpar(timeId, e.id), 'Escalação apagada');
          if (!ok) return;
          this.editando.set(false);
          this.salva.set(null);
        },
      }),
    );
  }

  /** Texto para o grupo do time (negrito no formato do WhatsApp). */
  private readonly texto = computed(() => {
    const e = this.evento();
    if (!e) return '';
    const nome = (v: VagaCampinho) => (v.atleta ? v.atleta.apelido || v.atleta.nome : '—');
    const linhas = ['Goleiro', 'Defesa', 'Meio', 'Ataque'].flatMap((rotulo) => {
      const nomes = this.vagas()
        .filter((v) => v.rotulo === rotulo)
        .map(nome);
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
      const [evento, cadastros, presencas, escalacao] = await Promise.all([
        this.eventosService.obter(timeId, eventoId),
        this.atletasService.listar(timeId),
        this.eventosService.listarPresencas(timeId, eventoId),
        this.service.obter(timeId, eventoId),
      ]);
      if (this.timeAtual.timeId() !== timeId || this.eventoId() !== eventoId) return;
      if (!evento) {
        this.naoEncontrado.set(true);
        return;
      }
      this.evento.set(evento);
      this.cadastros.set(cadastros);
      this.presencas.set(presencas);
      this.salva.set(escalacao);
    } catch (e) {
      this.avisos.erro('Erro ao carregar a escalação', e);
    }
  }
}
