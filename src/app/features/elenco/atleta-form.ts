import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormField, form, hidden, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { Atleta, STATUS_ATLETA, StatusAtleta } from '../../models/atleta.model';
import { MODALIDADES, Modalidade } from '../../models/modalidade.model';
import { POSICOES, Posicao } from '../../models/posicao.model';
import { ROTULO_MODALIDADE, ROTULO_POSICAO, ROTULO_STATUS_ATLETA, opcoes } from '../../shared/rotulos';
import { DadosAtleta } from './data/atletas.service';

// Signal Forms não usa null: campos opcionais são strings vazias e viram undefined ao salvar.
interface FormAtleta {
  nome: string;
  apelido: string;
  telefone: string;
  numeroCamisa: string;
  modalidade: Modalidade;
  posicoes: Posicao[];
  status: StatusAtleta;
}

function paraFormulario(atleta: Atleta | null, modalidadePadrao: Modalidade): FormAtleta {
  return {
    nome: atleta?.nome ?? '',
    apelido: atleta?.apelido ?? '',
    telefone: atleta?.telefone ?? '',
    numeroCamisa: atleta?.numeroCamisa?.toString() ?? '',
    modalidade: atleta?.modalidade ?? modalidadePadrao,
    posicoes: atleta?.posicoes ?? [],
    status: atleta?.status ?? 'ativo',
  };
}

function paraDados(f: FormAtleta): DadosAtleta {
  const telefone = f.telefone.trim();
  const numero = f.numeroCamisa.trim();
  return {
    nome: f.nome.trim(),
    apelido: f.apelido.trim(),
    modalidade: f.modalidade,
    posicoes: f.posicoes,
    status: f.status,
    ...(telefone ? { telefone } : {}),
    ...(numero ? { numeroCamisa: Number(numero) } : {}),
  };
}

@Component({
  selector: 'app-atleta-form',
  imports: [FormField, ButtonModule, InputTextModule, MultiSelectModule, SelectModule],
  templateUrl: './atleta-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtletaForm {
  readonly atleta = input<Atleta | null>(null);
  /** 'proprio': jogador editando o próprio cadastro (sem modalidade e status). */
  readonly modo = input<'completo' | 'proprio'>('completo');
  /** Modalidades habilitadas no time (DIRETRIZES 2.4). */
  readonly modalidades = input<readonly Modalidade[]>(MODALIDADES);
  readonly salvar = output<DadosAtleta>();
  readonly cancelar = output<void>();

  /** Habilitadas + a atual do atleta (mesmo se desabilitada depois), para não forçar troca ao editar. */
  protected readonly opcoesModalidade = computed(() => {
    const atual = this.atleta()?.modalidade;
    const lista = atual && !this.modalidades().includes(atual) ? [...this.modalidades(), atual] : this.modalidades();
    return opcoes(lista, ROTULO_MODALIDADE);
  });
  protected readonly opcoesPosicao = opcoes(POSICOES, ROTULO_POSICAO);
  protected readonly opcoesStatus = opcoes(STATUS_ATLETA, ROTULO_STATUS_ATLETA);

  protected readonly modelo = linkedSignal(() => paraFormulario(this.atleta(), this.modalidades()[0] ?? 'isento'));
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
  });

  protected enviar(): void {
    void submit(this.formulario, async () => this.salvar.emit(paraDados(this.modelo())));
  }
}
