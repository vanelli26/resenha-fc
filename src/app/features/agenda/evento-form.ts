import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormField, form, hidden, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ComId } from '../../core/firebase/conversor';
import { Campeonato } from '../../models/campeonato.model';
import { Evento, TIPOS_COM_ADVERSARIO, TIPOS_EVENTO, TipoEvento } from '../../models/evento.model';
import { ESPORTES_PADRAO, Esporte } from '../../models/posicao.model';
import { deDataInput, paraDataInput } from '../../shared/competencia';
import { ROTULO_ESPORTE, ROTULO_TIPO_EVENTO, opcoes } from '../../shared/rotulos';
import { DadosEvento } from './data/eventos.service';

export const MAX_SEMANAS = 12;

/** Campeonato escolhível no evento do tipo Campeonato. */
export interface OpcaoCampeonato {
  value: string;
  label: string;
}

/** Em andamento + o atual do evento (mesmo se encerrado). */
export function opcoesDeCampeonato(lista: ComId<Campeonato>[], atualId?: string): OpcaoCampeonato[] {
  return lista
    .filter((c) => c.status === 'andamento' || c.id === atualId)
    .map((c) => ({ value: c.id, label: `${c.nome} (${c.temporada})` }));
}

interface FormEvento {
  tipo: TipoEvento;
  titulo: string;
  esporte: Esporte;
  data: string;
  hora: string;
  local: string;
  adversario: string;
  /** '' = sem campeonato. */
  campeonatoId: string;
  repetir: boolean;
  semanas: number;
}

function paraFormulario(evento: Evento | null, esporte: Esporte): FormEvento {
  const data = evento?.data.toDate();
  return {
    tipo: evento?.tipo ?? 'jogo',
    titulo: evento?.titulo ?? '',
    esporte: evento?.esporte ?? esporte,
    data: data ? paraDataInput(data) : '',
    hora: data ? `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}` : '',
    local: evento?.local ?? '',
    adversario: evento?.adversario ?? '',
    campeonatoId: evento?.campeonatoId ?? '',
    repetir: false,
    semanas: 4,
  };
}

/** `AAAA-MM-DD` + `HH:mm` → Date local (fuso do aparelho; DIRETRIZES 1: America/Sao_Paulo). */
function dataHora(data: string, hora: string): Date {
  const dia = deDataInput(data);
  const [h, m] = hora.split(':').map(Number);
  dia.setHours(h, m, 0, 0);
  return dia;
}

/** Criar ou editar evento (diretoria). Na criação, pode repetir toda semana (N eventos independentes). */
@Component({
  selector: 'app-evento-form',
  imports: [FormField, ButtonModule, CheckboxModule, InputNumberModule, InputTextModule, SelectModule],
  templateUrl: './evento-form.html',
  styleUrl: '../../shared/formulario-compacto.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventoForm {
  readonly evento = input<Evento | null>(null);
  readonly esportes = input<readonly Esporte[]>(ESPORTES_PADRAO);
  /** Campeonatos em andamento (+ o do evento, se encerrado). Vazio: campo oculto. */
  readonly campeonatos = input<OpcaoCampeonato[]>([]);
  /** Campeonatos ainda sendo buscados (o campo aparece com carregando). */
  readonly carregandoCampeonatos = input(false);
  readonly salvando = input(false);
  readonly salvar = output<DadosEvento[]>();
  readonly cancelar = output<void>();

  protected readonly opcoesTipo = opcoes(TIPOS_EVENTO, ROTULO_TIPO_EVENTO);
  /** Esportes do time + o do evento (se o time deixou de praticá-lo). */
  protected readonly opcoesEsporte = computed(() => {
    const atual = this.evento()?.esporte;
    const lista = atual && !this.esportes().includes(atual) ? [...this.esportes(), atual] : this.esportes();
    return opcoes(lista, ROTULO_ESPORTE);
  });
  protected readonly maxSemanas = MAX_SEMANAS;
  protected readonly opcoesCampeonato = computed<OpcaoCampeonato[]>(() =>
    this.campeonatos().length > 0 ? [{ value: '', label: 'Nenhum' }, ...this.campeonatos()] : [],
  );

  protected readonly modelo = linkedSignal(() => paraFormulario(this.evento(), this.esportes()[0] ?? 'society'));
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.titulo, { message: 'Informe o título.' });
    maxLength(p.titulo, 80, { message: 'Máximo de 80 caracteres.' });
    required(p.data, { message: 'Informe a data.' });
    required(p.hora, { message: 'Informe a hora.' });
    maxLength(p.local, 120, { message: 'Máximo de 120 caracteres.' });
    maxLength(p.adversario, 60, { message: 'Máximo de 60 caracteres.' });
    hidden(p.adversario, { when: ({ valueOf }) => !TIPOS_COM_ADVERSARIO.includes(valueOf(p.tipo)) });
    hidden(p.esporte, { when: () => this.opcoesEsporte().length < 2 });
    hidden(p.campeonatoId, { when: ({ valueOf }) => valueOf(p.tipo) !== 'campeonato' || (!this.carregandoCampeonatos() && this.opcoesCampeonato().length < 2) });
    // Repetição só na criação.
    hidden(p.repetir, { when: () => this.evento() !== null });
    hidden(p.semanas, { when: ({ valueOf }) => this.evento() !== null || !valueOf(p.repetir) });
    min(p.semanas, 2, { message: `De 2 a ${MAX_SEMANAS} semanas.` });
    max(p.semanas, MAX_SEMANAS, { message: `De 2 a ${MAX_SEMANAS} semanas.` });
  });

  protected enviar(): void {
    void submit(this.formulario, async () => {
      const f = this.modelo();
      const adversario = TIPOS_COM_ADVERSARIO.includes(f.tipo) ? f.adversario.trim() : '';
      const base: DadosEvento = {
        tipo: f.tipo,
        titulo: f.titulo.trim(),
        data: dataHora(f.data, f.hora),
        local: f.local.trim(),
        esporte: f.esporte,
        ...(adversario ? { adversario } : {}),
        ...(f.tipo === 'campeonato' && f.campeonatoId ? { campeonatoId: f.campeonatoId } : {}),
      };
      const vezes = this.evento() === null && f.repetir ? f.semanas : 1;
      const eventos = Array.from({ length: vezes }, (_, i) => {
        const data = new Date(base.data);
        data.setDate(data.getDate() + 7 * i);
        return { ...base, data };
      });
      this.salvar.emit(eventos);
    });
  }
}
