import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { SessaoService } from '../../core/sessao/sessao.service';
import { Escudo } from '../../shared/escudo';
import { ROTULO_PAPEL } from '../../shared/rotulos';

@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink, ButtonModule, SkeletonModule, Escudo, ChevronRight],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  private readonly sessao = inject(SessaoService);

  protected readonly meusTimes = this.sessao.meusTimes;
  protected readonly carregando = this.sessao.carregandoTimes;
  protected readonly adminGeral = this.sessao.adminGeral;
  protected readonly rotuloPapel = ROTULO_PAPEL;
}
