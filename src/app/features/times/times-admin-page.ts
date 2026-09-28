import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, readonly, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ComId } from '../../core/firebase/conversor';
import { SessaoService } from '../../core/sessao/sessao.service';
import { amostraDaCor } from '../../core/theme/app-theme';
import { ESPORTES, ESPORTES_PADRAO, Esporte } from '../../models/posicao.model';
import { CORES_TIME, CorTime, TimeGravado } from '../../models/time.model';
import { Avisos } from '../../shared/avisos';
import { Escudo } from '../../shared/escudo';
import { FotoProcessada, fotoParaEnvio } from '../../shared/imagem';
import { ROTULO_COR, ROTULO_ESPORTE, opcoes } from '../../shared/rotulos';
import { TimesService } from './data/times.service';

interface FormTime {
  slug: string;
  nome: string;
  cor: CorTime;
  esportes: Esporte[];
}

const FORM_VAZIO: FormTime = { slug: '', nome: '', cor: 'emerald', esportes: [...ESPORTES_PADRAO] };

/** Cadastro de times — só adminGeral (rota e Rules). */
@Component({
  selector: 'app-times-admin-page',
  imports: [FormField, RouterLink, ButtonModule, InputTextModule, SelectButtonModule, Escudo],
  templateUrl: './times-admin-page.html',
  styleUrl: './times-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesAdminPage {
  private readonly timesService = inject(TimesService);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(Avisos);

  protected readonly times = signal<ComId<TimeGravado>[]>([]);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly cores = CORES_TIME.map((cor) => ({ cor, rotulo: ROTULO_COR[cor], amostra: amostraDaCor(cor) }));
  protected readonly rotuloCor = ROTULO_COR;
  protected readonly opcoesEsporte = opcoes(ESPORTES, ROTULO_ESPORTE);

  // Escudo fica fora do formulário: vem de upload, não de digitação.
  /** Escudo gravado (URL do Storage ou data URL antigo) mantido na edição; null = sem escudo. */
  protected readonly escudo = signal<string | null>(null);
  /** Escudo novo escolhido, ainda não enviado (prévia local). */
  private readonly novoEscudo = signal<{ foto: FotoProcessada; previa: string } | null>(null);
  protected readonly previaEscudo = computed(() => this.novoEscudo()?.previa ?? this.escudo());
  /** Escudo do time antes da edição: apagado do Storage se for trocado ou removido. */
  private escudoOriginal: string | null = null;
  protected readonly processandoImagem = signal(false);

  protected readonly modelo = signal<FormTime>({ ...FORM_VAZIO });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 60, { message: 'Máximo de 60 caracteres.' });
    required(p.slug, { message: 'Informe o identificador.' });
    pattern(p.slug, /^[a-z0-9-]{2,40}$/, { message: 'Use 2 a 40 letras minúsculas, números ou hífen.' });
    // Slug é o ID do documento: imutável depois de criado.
    readonly(p.slug, { when: () => this.editandoId() !== null });
    validate(p.esportes, ({ value }) =>
      value().length > 0 ? undefined : { kind: 'esportes', message: 'Escolha ao menos um esporte.' },
    );
  });

  constructor() {
    void this.carregar();
  }

  protected editar(time: ComId<TimeGravado>): void {
    this.editandoId.set(time.id);
    // Times antigos (campo `tema`) não têm `cor`: começa na cor base até salvar.
    this.modelo.set({
      slug: time.slug,
      nome: time.nome,
      cor: time.cor ?? FORM_VAZIO.cor,
      esportes: [...(time.esportes ?? ESPORTES_PADRAO)],
    });
    this.escudo.set(time.escudo);
    this.escudoOriginal = time.escudo;
    this.limparNovoEscudo();
  }

  protected cancelar(): void {
    this.editandoId.set(null);
    this.modelo.set({ ...FORM_VAZIO, esportes: [...FORM_VAZIO.esportes] });
    this.escudo.set(null);
    this.escudoOriginal = null;
    this.limparNovoEscudo();
    this.formulario().reset();
  }

  protected removerEscudo(): void {
    this.escudo.set(null);
    this.limparNovoEscudo();
  }

  private limparNovoEscudo(): void {
    const atual = this.novoEscudo();
    if (atual) URL.revokeObjectURL(atual.previa);
    this.novoEscudo.set(null);
  }

  protected async escolherEscudo(evento: Event): Promise<void> {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) return;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;
    this.processandoImagem.set(true);
    try {
      // PNG como alternativa ao WebP: mantém a transparência do escudo.
      const foto = await fotoParaEnvio(arquivo, 512, 'image/png');
      this.limparNovoEscudo();
      this.novoEscudo.set({ foto, previa: URL.createObjectURL(foto.blob) });
    } catch (e) {
      this.avisos.erro('Imagem não aceita', e);
    } finally {
      this.processandoImagem.set(false);
    }
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const { slug, nome, cor, esportes } = this.modelo();
      const id = this.editandoId();
      const novo = this.novoEscudo();
      const original = this.escudoOriginal;
      let enviado: string | null = null;
      try {
        // Escudo novo vai antes para o Storage; se gravar o time falhar, o arquivo enviado é apagado.
        if (novo) enviado = await this.timesService.enviarEscudo(id ?? slug, novo.foto);
        const dados = { nome, cor, esportes, escudo: enviado ?? this.escudo() };
        try {
          if (id) {
            await this.timesService.atualizar(id, dados);
          } else {
            await this.timesService.criar(slug, dados);
          }
        } catch (e) {
          await this.timesService.apagarEscudo(enviado);
          throw e;
        }
        if (original !== dados.escudo) await this.timesService.apagarEscudo(original);
        this.avisos.sucesso(id ? 'Time atualizado' : 'Time criado');
        this.cancelar();
        await Promise.all([this.carregar(), this.sessao.carregarMeusTimes()]);
      } catch (e) {
        this.avisos.erro('Não foi possível salvar', e);
      }
    });
  }

  private async carregar(): Promise<void> {
    try {
      this.times.set(await this.timesService.listar());
    } catch (e) {
      this.avisos.erro('Erro ao carregar times', e);
    }
  }
}
