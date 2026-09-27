import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormField, form, hidden, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { Atleta, STATUS_ATLETA, StatusAtleta, TipoVinculo, VINCULOS, vinculoDe } from '../../models/atleta.model';
import { ISENTO, Modalidade } from '../../models/modalidade.model';
import {
  ESPORTES,
  ESPORTES_PADRAO,
  Esporte,
  POSICOES_POR_ESPORTE,
  PosicaoCampo,
  PosicaoFutsal,
  PosicaoSociety,
  PosicoesAtleta,
  esportesComPosicao,
} from '../../models/posicao.model';
import {
  Opcao,
  ROTULO_ESPORTE,
  ROTULO_POSICAO,
  ROTULO_STATUS_ATLETA,
  ROTULO_VINCULO,
  opcoes,
} from '../../shared/rotulos';
import { DadosAtleta } from './data/atletas.service';

// Signal Forms não usa null: campos opcionais são strings vazias e viram undefined ao salvar.
interface FormAtleta {
  nome: string;
  apelido: string;
  telefone: string;
  numeroCamisa: string;
  modalidade: Modalidade;
  posicoes: { campo: PosicaoCampo[]; society: PosicaoSociety[]; futsal: PosicaoFutsal[] };
  status: StatusAtleta;
  vinculo: TipoVinculo;
}

function paraFormulario(atleta: Atleta | null, modalidadePadrao: Modalidade): FormAtleta {
  return {
    nome: atleta?.nome ?? '',
    apelido: atleta?.apelido ?? '',
    telefone: atleta?.telefone ?? '',
    numeroCamisa: atleta?.numeroCamisa?.toString() ?? '',
    modalidade: atleta?.modalidade ?? modalidadePadrao,
    posicoes: {
      campo: atleta?.posicoes.campo ?? [],
      society: atleta?.posicoes.society ?? [],
      futsal: atleta?.posicoes.futsal ?? [],
    },
    status: atleta?.status ?? 'ativo',
    vinculo: atleta ? vinculoDe(atleta) : 'atleta',
  };
}

function paraDados(f: FormAtleta): DadosAtleta {
  const telefone = f.telefone.trim();
  // Posições e camisa só para quem joga; sócio e colaborador ficam sem.
  const joga = f.vinculo === 'atleta';
  const numero = joga ? f.numeroCamisa.trim() : '';
  const { campo, society, futsal } = f.posicoes;
  const posicoes: PosicoesAtleta = joga
    ? {
        ...(campo.length ? { campo } : {}),
        ...(society.length ? { society } : {}),
        ...(futsal.length ? { futsal } : {}),
      }
    : {};
  return {
    nome: f.nome.trim(),
    apelido: f.apelido.trim(),
    modalidade: f.modalidade,
    posicoes,
    status: f.status,
    vinculo: f.vinculo,
    ...(telefone ? { telefone } : {}),
    ...(numero ? { numeroCamisa: Number(numero) } : {}),
  };
}

@Component({
  selector: 'app-atleta-form',
  imports: [FormField, ButtonModule, InputTextModule, MultiSelectModule, SelectModule],
  templateUrl: './atleta-form.html',
  styleUrl: '../../shared/formulario-compacto.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtletaForm {
  readonly atleta = input<Atleta | null>(null);
  /** 'proprio': jogador editando o próprio cadastro (sem modalidade, status e vínculo). */
  readonly modo = input<'completo' | 'proprio'>('completo');
  /** Planos do time + Isento (DIRETRIZES 2.4). */
  readonly opcoesModalidade = input<Opcao<Modalidade>[]>([{ value: ISENTO, label: 'Isento' }]);
  /** Modalidade de um cadastro novo. */
  readonly modalidadePadrao = input<Modalidade>(ISENTO);
  /** Esportes do time: um grupo de posições para cada. */
  readonly esportes = input<readonly Esporte[]>(ESPORTES_PADRAO);
  readonly salvar = output<DadosAtleta>();
  readonly cancelar = output<void>();

  /** Opções + a atual do atleta, mesmo se o plano foi removido (não força troca ao editar). */
  protected readonly opcoesModalidadeComAtual = computed(() => {
    const atual = this.atleta()?.modalidade;
    const opcoes = this.opcoesModalidade();
    return atual && !opcoes.some((o) => o.value === atual) ? [...opcoes, { value: atual, label: 'Plano removido' }] : opcoes;
  });
  /** Esportes do time + os que o atleta já tem posição (não apaga dado se o time deixar um esporte). */
  protected readonly esportesVisiveis = computed(() => {
    const doAtleta = esportesComPosicao(this.atleta()?.posicoes ?? {});
    return ESPORTES.filter((e) => this.esportes().includes(e) || doAtleta.includes(e));
  });
  protected readonly opcoesPosicao = {
    campo: opcoes(POSICOES_POR_ESPORTE.campo, ROTULO_POSICAO),
    society: opcoes(POSICOES_POR_ESPORTE.society, ROTULO_POSICAO),
    futsal: opcoes(POSICOES_POR_ESPORTE.futsal, ROTULO_POSICAO),
  };
  protected readonly rotuloEsporte = ROTULO_ESPORTE;
  protected readonly opcoesVinculo = opcoes(VINCULOS, ROTULO_VINCULO);
  protected readonly opcoesStatus = opcoes(STATUS_ATLETA, ROTULO_STATUS_ATLETA);

  protected readonly modelo = linkedSignal(() =>
    paraFormulario(this.atleta(), this.modalidadePadrao()),
  );
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 100, { message: 'Máximo de 100 caracteres.' });
    maxLength(p.apelido, 40, { message: 'Máximo de 40 caracteres.' });
    maxLength(p.telefone, 20, { message: 'Máximo de 20 caracteres.' });
    pattern(p.telefone, /^[0-9()+\-\s]*$/, { message: 'Use só números, espaço, (, ), + e -.' });
    pattern(p.numeroCamisa, /^\d{0,3}$/, { message: 'Número de 0 a 999.' });
    const proprio = () => this.modo() === 'proprio';
    hidden(p.modalidade, { when: proprio });
    hidden(p.status, { when: proprio });
    // Sócio e colaborador entram por convite (com conta): cadastro sem conta só pode ser atleta.
    hidden(p.vinculo, { when: () => proprio() || !this.atleta()?.uid });
    // Posições e camisa só para quem joga.
    hidden(p.numeroCamisa, { when: ({ valueOf }) => valueOf(p.vinculo) !== 'atleta' });
    hidden(p.posicoes, { when: ({ valueOf }) => valueOf(p.vinculo) !== 'atleta' });
  });

  protected enviar(): void {
    void submit(this.formulario, async () => this.salvar.emit(paraDados(this.modelo())));
  }
}
