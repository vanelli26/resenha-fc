import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DOCUMENT, computed, effect, inject, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Convite } from '../../models/convite.model';
import { Avisos } from '../../shared/avisos';
import { abrirWhatsApp, copiarTexto } from '../../shared/compartilhar';
import { Voltar } from '../../shared/voltar';
import { ConvitesService, VALIDADE_CONVITE_DIAS, conviteValido } from './data/convites.service';

type Situacao = 'ativo' | 'expirado' | 'desativado';

interface ConviteVisao {
  codigo: string;
  link: string;
  expiraEm: Date;
  situacao: Situacao;
}

@Component({
  selector: 'app-convites-page',
  imports: [DatePipe, ButtonModule, SkeletonModule, TagModule, Voltar],
  templateUrl: './convites-page.html',
  styleUrl: './convites-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConvitesPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly convitesService = inject(ConvitesService);
  private readonly avisos = inject(Avisos);
  private readonly origem = inject(DOCUMENT).location.origin;

  protected readonly validadeDias = VALIDADE_CONVITE_DIAS;
  protected readonly carregando = signal(true);
  protected readonly gerando = signal(false);
  private readonly convites = signal<ComId<Convite>[]>([]);

  protected readonly lista = computed<ConviteVisao[]>(() => {
    const timeId = this.timeAtual.timeId();
    return this.convites().map((c) => ({
      codigo: c.id,
      link: `${this.origem}/convite/${timeId}/${c.id}`,
      expiraEm: c.expiraEm.toDate(),
      situacao: !c.ativo ? 'desativado' : conviteValido(c) ? 'ativo' : 'expirado',
    }));
  });

  constructor() {
    // A tela é reaproveitada ao trocar de time (/t/A → /t/B): recarrega sempre que o time muda.
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.convites.set([]);
        if (timeId) void this.carregar();
      });
    });
  }

  protected async gerar(): Promise<void> {
    const time = this.timeAtual.time();
    const uid = this.auth.usuario()?.uid;
    if (!time || !uid) return;
    this.gerando.set(true);
    try {
      const codigo = await this.convitesService.criar(time, uid);
      await this.carregar();
      await this.copiar(`${this.origem}/convite/${time.id}/${codigo}`);
    } catch (e) {
      this.avisos.erro('Não foi possível gerar', e);
    } finally {
      this.gerando.set(false);
    }
  }

  protected async copiar(link: string): Promise<void> {
    if (await copiarTexto(link)) this.avisos.sucesso('Link copiado', 'Envie para quem vai entrar no time.');
    else this.avisos.info('Copie o link', link, 10000);
  }

  /** Compartilhamento nativo do celular; sem suporte, abre o WhatsApp com o texto pronto. */
  protected async compartilhar(link: string): Promise<void> {
    const nome = this.timeAtual.time()?.nome ?? 'o time';
    const texto = `Entre no ${nome} pelo ResenhaFC: ${link}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Convite · ${nome}`, text: texto });
        return;
      } catch (e) {
        // Usuário fechou a folha de compartilhamento: nada a fazer.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    abrirWhatsApp(texto);
  }

  protected async desativar(codigo: string): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    try {
      await this.convitesService.desativar(timeId, codigo);
      await this.carregar();
    } catch (e) {
      this.avisos.erro('Não foi possível desativar', e);
    }
  }

  private async carregar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.carregando.set(true);
    try {
      const dados = await this.convitesService.listar(timeId);
      // Descarta resposta atrasada de um time anterior.
      if (this.timeAtual.timeId() === timeId) this.convites.set(dados);
    } catch (e) {
      this.avisos.erro('Erro ao carregar convites', e);
    } finally {
      this.carregando.set(false);
    }
  }
}
