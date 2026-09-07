import { Component, DestroyRef, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { JsonPipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { environment } from '../../environments/environment';
import { isApiError } from '../models/api-error.model';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  DayType,
  PlacePayload,
  PlaceResponse
} from '../models/place.model';
import { DayForm, PlaceForm, TimeSlot } from './place-form.types';

const HHMM_PATTERN = /^(\d{2}):(\d{2})$/;

@Component({
  selector: 'app-place-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    JsonPipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './place-form.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './place-form.scss'
})
export class PlaceFormComponent {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // Base da API vem do environment: /api em dev (via proxy) e em produção.
  private readonly endpoint = `${environment.apiUrl}/place`;

  readonly daysOfWeek = DAYS_OF_WEEK;

  /** true enquanto um POST está em voo — bloqueia envios duplicados. */
  readonly saving = signal(false);

  /**
   * Identidade estável de cada faixa, para o `track` do @for.
   * Sem isso, `track group` recria todo o DOM quando o array é
   * reconstruído (NG0956) e `track $index` desalinha os erros de
   * validação ao remover uma faixa do meio da lista.
   */
  private nextDayId = 0;
  private readonly dayIds = new WeakMap<DayForm, number>();

  readonly trackDay = (_index: number, group: DayForm): number =>
    this.dayIds.get(group) ?? -1;

  readonly form: PlaceForm;

  constructor() {
    this.form = new FormGroup({
      label: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      }),
      location: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      }),
      days: new FormArray<DayForm>([], {
        validators: [(control) => this.daysNoOverlapValidator(control)]
      })
    });

    // começa com uma faixa exemplo
    this.addDay();
  }

  get days(): FormArray<DayForm> {
    return this.form.controls.days;
  }

  // --- MÉTODOS PÚBLICOS DO COMPONENTE ---

  addDay(): void {
    this.days.push(this.buildDay());
  }

  removeDay(index: number): void {
    this.days.removeAt(index);
    this.days.updateValueAndValidity(); // reavalia overlaps
  }

  reset(): void {
    if (this.saving()) return;
    this.resetForm();
  }

  /** Limpa o formulário sem o guard de `saving` — usado também após o POST. */
  private resetForm(): void {
    this.form.reset();
    this.days.clear();
    this.addDay();
  }

  payload(): PlacePayload {
    // Com o formulário tipado, getRawValue() já devolve a forma correta:
    // nenhum cast e nenhum `any` são necessários aqui.
    const { label, location, days } = this.form.getRawValue();
    return { label, location, days };
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('Há erros no formulário. Verifique os horários.', 'Fechar', {
        duration: 3000
      });
      return;
    }

    if (this.saving()) return; // guarda contra duplo clique / Enter repetido

    this.saving.set(true);

    this.http
      .post<PlaceResponse[]>(this.endpoint, [this.payload()])
      .pipe(
        // finalize roda em sucesso, erro e cancelamento
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.resetForm();
          this.snack.open('Salvo com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (err: unknown) => {
          console.error(err);
          this.snack.open(this.toErrorMessage(err), 'Fechar', { duration: 5000 });
        }
      });
  }

  // --- MÉTODOS PRIVADOS E VALIDADORES ---

  /**
   * Traduz o erro para uma mensagem exibível.
   * O parâmetro é `unknown` porque o RxJS não garante o tipo: além do
   * HttpErrorResponse, qualquer exceção lançada no `next` ou num
   * interceptor chega aqui. O narrowing é feito em runtime.
   */
  private toErrorMessage(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'Erro inesperado ao salvar.';
    }

    if (err.status === 0) {
      return 'Sem conexão com o servidor.';
    }

    // err.error é `any` no HttpErrorResponse — reatribuir para `unknown`
    // obriga a validação antes do uso e impede o `any` de escapar.
    const body: unknown = err.error;
    if (isApiError(body)) {
      const details = body.details?.length ? ` (${body.details.join('; ')})` : '';
      return `${body.message}${details}`;
    }

    return `Falha ao salvar (HTTP ${err.status}).`;
  }

  private buildDay(): DayForm {
    const group: DayForm = new FormGroup(
      {
        dayOfWeek: new FormControl<DayOfWeek>('wednesday', {
          nonNullable: true,
          validators: [Validators.required]
        }),
        startTime: new FormControl('11:30', {
          nonNullable: true,
          validators: [Validators.required]
        }),
        endTime: new FormControl('15:00', {
          nonNullable: true,
          validators: [Validators.required]
        }),
        type: new FormControl<DayType>('OPEN', {
          nonNullable: true,
          validators: [Validators.required]
        })
      },
      { validators: [(control) => this.dayRangeValidator(control)] }
    );

    this.dayIds.set(group, this.nextDayId++);

    // Revalida overlaps quando algum campo muda.
    // takeUntilDestroyed evita que a inscrição sobreviva ao componente.
    group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.days.updateValueAndValidity({ onlySelf: true }));

    return group;
  }

  /** Helpers de tempo */
  private toMinutes(hhmm: string | null | undefined): number | null {
    const match = HHMM_PATTERN.exec(hhmm ?? '');
    if (match === null) return null;

    // Os grupos 1 e 2 existem sempre que o regex casa, mas com
    // noUncheckedIndexedAccess é preciso comprovar isso ao compilador.
    const [, rawHours, rawMinutes] = match;
    if (rawHours === undefined || rawMinutes === undefined) return null;

    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    if (hours > 23 || minutes > 59) return null;

    return hours * 60 + minutes;
  }

  /** Trata "00:00" como 24:00 para representar fim-de-dia */
  private endToMinutes(hhmm: string | null | undefined): number | null {
    if (hhmm === '00:00') return 24 * 60;
    return this.toMinutes(hhmm);
  }

  /** Validador por faixa (grupo) — garante início < fim e não iguais */
  private dayRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = this.toMinutes(group.get('startTime')?.value as string | null);
    const end = this.endToMinutes(group.get('endTime')?.value as string | null);
    if (start === null || end === null) return null; // required cuida disso
    return end <= start ? { range: true } : null;
  }

  /** Marca/limpa erro 'overlap' em grupos específicos */
  private setGroupOverlapError(group: DayForm, hasError: boolean): void {
    const errors = { ...(group.errors ?? {}) };

    if (hasError) {
      errors['overlap'] = true;
      group.setErrors(errors, { emitEvent: false });
      return;
    }

    if ('overlap' in errors) {
      delete errors['overlap'];
      const remaining = Object.keys(errors).length > 0 ? errors : null;
      group.setErrors(remaining, { emitEvent: false });
    }
  }

  /** Agrupa as faixas válidas por dia da semana, já convertidas em minutos */
  private groupSlotsByDay(controls: readonly DayForm[]): Map<DayOfWeek, TimeSlot[]> {
    const byDay = new Map<DayOfWeek, TimeSlot[]>();

    for (const group of controls) {
      const dayOfWeek = group.controls.dayOfWeek.value;
      const start = this.toMinutes(group.controls.startTime.value);
      const end = this.endToMinutes(group.controls.endTime.value);
      if (start === null || end === null) continue;

      const slot: TimeSlot = { start, end, group };
      const bucket = byDay.get(dayOfWeek);
      if (bucket === undefined) {
        byDay.set(dayOfWeek, [slot]);
      } else {
        bucket.push(slot);
      }
    }

    return byDay;
  }

  /** Validador no FormArray (todas as faixas) — detecta overlaps por dia */
  private daysNoOverlapValidator(array: AbstractControl): ValidationErrors | null {
    const controls = (array as FormArray<DayForm>).controls;

    // Limpa marcas antigas
    for (const group of controls) {
      this.setGroupOverlapError(group, false);
    }

    let hasOverlap = false;

    for (const slots of this.groupSlotsByDay(controls).values()) {
      // Comparação par a par: cobre também o caso de uma faixa
      // conter inteiramente outra, que a varredura sequencial perdia.
      // Intervalos [start, end) — end == start é permitido (faixas coladas).
      slots.forEach((current, index) => {
        for (const other of slots.slice(index + 1)) {
          if (current.start < other.end && other.start < current.end) {
            hasOverlap = true;
            this.setGroupOverlapError(current.group, true);
            this.setGroupOverlapError(other.group, true);
          }
        }
      });
    }

    return hasOverlap ? { overlap: true } : null;
  }
}
