import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { FormField, form, max, min, required, submit, validate } from '@angular/forms/signals';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { ConfigFinanceira } from '../../models/time.model';
import { NOMES_MESES } from '../../shared/competencia';
import { centavosParaReais, reaisParaCentavos } from '../../shared/dinheiro';
import { mensagemDeErro } from '../../shared/erros';
import { Voltar } from '../../shared/voltar';
import { ConfigFinanceiraService, ModalidadesFinanceiras } from './data/config-financeira.service';
import { DespesasRecorrentes } from './despesas-recorrentes';

// Valores em reais no formulário; centavos só ao gravar.
interface FormModalidades {
  mensal: { ativo: boolean; valor: number; dia: number };
  semestral: { ativo: boolean; valor: number; dia: number; mesS1: number; mesS2: number };
  avulso: { ativo: boolean; valor: number };
}

function paraFormulario(f: ConfigFinanceira | undefined): FormModalidades {
  return {
    mensal: {
      ativo: f?.mensal.ativo ?? false,
      valor: centavosParaReais(f?.mensal.valorCentavos ?? 0),
      dia: f?.mensal.diaVencimento ?? 10,
    },
    semestral: {
      ativo: f?.semestral.ativo ?? false,
      valor: centavosParaReais(f?.semestral.valorCentavos ?? 0),
      dia: f?.semestral.diaVencimento ?? 10,
      mesS1: f?.semestral.mesVencimentoS1 ?? 1,
      mesS2: f?.semestral.mesVencimentoS2 ?? 7,
    },
    avulso: {
      ativo: f?.avulso.ativo ?? false,
      valor: centavosParaReais(f?.avulso.valorCentavos ?? 0),
    },
  };
}

function paraDados(f: FormModalidades): ModalidadesFinanceiras {
  return {
    mensal: { ativo: f.mensal.ativo, valorCentavos: reaisParaCentavos(f.mensal.valor), diaVencimento: f.mensal.dia },
    semestral: {
      ativo: f.semestral.ativo,
      valorCentavos: reaisParaCentavos(f.semestral.valor),
      diaVencimento: f.semestral.dia,
      mesVencimentoS1: f.semestral.mesS1,
      mesVencimentoS2: f.semestral.mesS2,
    },
    avulso: { ativo: f.avulso.ativo, valorCentavos: reaisParaCentavos(f.avulso.valor) },
  };
}

const mesesDe = (inicio: number) =>
  NOMES_MESES.slice(inicio - 1, inicio + 5).map((label, i) => ({ label, value: inicio + i }));

@Component({
  selector: 'app-config-financeira-page',
  imports: [FormField, ButtonModule, InputNumberModule, SelectModule, ToggleSwitchModule, Voltar, DespesasRecorrentes],
  templateUrl: './config-financeira-page.html',
  styleUrl: './config-financeira-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigFinanceiraPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(ConfigFinanceiraService);
  private readonly mensagens = inject(MessageService);

  protected readonly mesesS1 = mesesDe(1);
  protected readonly mesesS2 = mesesDe(7);

  // Recomeça do time atual ao trocar de time (a tela é reaproveitada).
  protected readonly modelo = linkedSignal(() => paraFormulario(this.timeAtual.time()?.financeiro));
  protected readonly formulario = form(this.modelo, (p) => {
    for (const modalidade of [p.mensal, p.semestral, p.avulso]) {
      validate(modalidade.valor, ({ value, valueOf }) =>
        valueOf(modalidade.ativo) && !((value() ?? 0) > 0)
          ? { kind: 'valor', message: 'Informe o valor para ativar.' }
          : undefined,
      );
    }
    for (const dia of [p.mensal.dia, p.semestral.dia]) {
      required(dia, { message: 'Informe o dia.' });
      min(dia, 1, { message: 'Dia de 1 a 31.' });
      max(dia, 31, { message: 'Dia de 1 a 31.' });
    }
  });

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const time = this.timeAtual.time();
      if (!time) return;
      const dados = paraDados(this.modelo());
      try {
        await this.service.salvarModalidades(time.id, dados);
        this.timeAtual.definirFinanceiro({ ...time.financeiro, ...dados });
        this.mensagens.add({ severity: 'success', summary: 'Configuração salva' });
      } catch (e) {
        this.mensagens.add({ severity: 'error', summary: 'Não foi possível salvar', detail: mensagemDeErro(e) });
      }
    });
  }
}
