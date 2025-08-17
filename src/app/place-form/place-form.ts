import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

type DayType = 'OPEN' | 'CLOSED';
type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

interface DayItem {
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  type: DayType;
}

interface PlacePayload {
  label: string;
  location: string;
  days: DayItem[];
}

/** Helpers de tempo */
function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Trata "00:00" como 24:00 para representar fim-de-dia */
function endToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  if (hhmm === '00:00') return 24 * 60;
  return toMinutes(hhmm);
}

/** Validador por faixa (grupo) — garante início < fim e não iguais */
function dayRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = toMinutes(group.get('startTime')?.value);
  const end = endToMinutes(group.get('endTime')?.value);
  if (start == null || end == null) return null; // required cuida disso
  if (end <= start) {
    return { range: true }; // fim precisa ser depois do início
  }
  return null;
}

/** Marca/limpa erro 'overlap' em grupos específicos */
function setGroupOverlapError(group: AbstractControl, hasError: boolean) {
  const errors = { ...(group.errors || {}) };
  if (hasError) {
    errors['overlap'] = true;
    group.setErrors(errors);
  } else {
    if ('overlap' in errors) {
      delete errors['overlap'];
      const final = Object.keys(errors).length ? errors : null;
      group.setErrors(final);
    }
  }
}

/** Validador no FormArray (todas as faixas) — detecta overlaps por dia */
function daysNoOverlapValidator(array: AbstractControl): ValidationErrors | null {
  const fa = array as FormArray<FormGroup>;
  // Limpa marcas antigas
  fa.controls.forEach((g) => setGroupOverlapError(g, false));

  // Mapear por dia
  const byDay = new Map<
    DayOfWeek,
    { start: number; end: number; group: AbstractControl }[]
  >();

  for (const g of fa.controls) {
    const d = g.get('dayOfWeek')?.value as DayOfWeek | null;
    const s = toMinutes(g.get('startTime')?.value);
    const e = endToMinutes(g.get('endTime')?.value);
    if (!d || s == null || e == null) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push({ start: s, end: e, group: g });
  }

  let hasOverlap = false;

  for (const [, list] of byDay) {
    // ordenar por início
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      // intervalos [start, end) — end==start é permitido (colado)
      if (curr.start < prev.end) {
        hasOverlap = true;
        setGroupOverlapError(prev.group, true);
        setGroupOverlapError(curr.group, true);
      }
    }
  }

  return hasOverlap ? { overlap: true } : null;
}

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
    MatSnackBarModule
  ],
  template: `
    <mat-card>
      <h2>Novo Local</h2>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
        <div class="row">
          <mat-form-field appearance="outline" class="flex">
            <mat-label>Label</mat-label>
            <input matInput formControlName="label" required />
            @if (form.get('label')?.hasError('required')) {
              <mat-error>Obrigatório.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex">
            <mat-label>Location</mat-label>
            <input matInput formControlName="location" required />
            @if (form.get('location')?.hasError('required')) {
              <mat-error>Obrigatório.</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-divider class="mb-12"></mat-divider>

        <div class="row space-between">
          <h3 class="m0">Dias / Horários</h3>
          <button mat-raised-button color="primary" type="button" (click)="addDay()">
            <mat-icon>add</mat-icon> Adicionar faixa
          </button>
        </div>

        <div formArrayName="days" class="days">
          @for (group of days.controls; track $index; let i = $index) {
            <div class="day" [formGroupName]="i">
              <mat-form-field appearance="outline" class="dow">
                <mat-label>Dia da semana</mat-label>
                <mat-select formControlName="dayOfWeek" required>
                  @for (d of daysOfWeek; track d) {
                    <mat-option [value]="d">{{ d }}</mat-option>
                  }
                </mat-select>
                @if (group.get('dayOfWeek')?.hasError('required')) {
                  <mat-error>Obrigatório.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="time">
                <mat-label>Início</mat-label>
                <input matInput type="time" formControlName="startTime" required />
                @if (group.get('startTime')?.hasError('required')) {
                  <mat-error>Obrigatório.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="time">
                <mat-label>Fim</mat-label>
                <input matInput type="time" formControlName="endTime" required />
                @if (group.get('endTime')?.hasError('required')) {
                  <mat-error>Obrigatório.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="type">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="type" required>
                  <mat-option value="OPEN">OPEN</mat-option>
                  <mat-option value="CLOSED">CLOSED</mat-option>
                </mat-select>
                @if (group.get('type')?.hasError('required')) {
                  <mat-error>Obrigatório.</mat-error>
                }
              </mat-form-field>

              <button
                mat-icon-button
                color="warn"
                type="button"
                (click)="removeDay(i)"
                aria-label="Remover faixa"
              >
                <mat-icon>delete</mat-icon>
              </button>

              <!-- Mensagens de validação da faixa -->
              @if (group.invalid) {
                <div class="errors">
                  @if (group.hasError('range')) {
                    <span class="error">
                      Horário inválido: o fim deve ser depois do início (use 00:00 para meia-noite).
                    </span>
                  }
                  @if (group.hasError('overlap')) {
                    <span class="error"> Conflito com outra faixa deste dia. </span>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Mensagem geral de conflito -->
        @if (days.hasError('overlap')) {
          <div class="errors">
            <span class="error">
              Existem conflitos de horário no mesmo dia. Ajuste as faixas.
            </span>
          </div>
        }

        <div class="actions">
          <button mat-raised-button color="primary" [disabled]="form.invalid">
            Salvar
          </button>
          <button mat-stroked-button type="button" (click)="reset()">Limpar</button>
        </div>
      </form>
    </mat-card>

    <mat-card class="mt-16">
      <h3 class="m0">Prévia do JSON</h3>
      <pre class="preview">{{ payload() | json }}</pre>
    </mat-card>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .space-between {
        justify-content: space-between;
        align-items: center;
      }
      .flex {
        flex: 1 1 320px;
      }
      .days {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .day {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .dow {
        width: 180px;
      }
      .type {
        width: 140px;
      }
      .time {
        width: 140px;
      }
      .actions {
        display: flex;
        gap: 12px;
      }
      .mt-16 {
        margin-top: 16px;
      }
      .mb-12 {
        margin-bottom: 12px;
      }
      .m0 {
        margin: 0;
      }
      .preview {
        white-space: pre-wrap;
      }
      .errors {
        width: 100%;
      }
      .error {
        color: #d32f2f;
        font-size: 12px;
      }
    `
  ]
})
export class PlaceFormComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);

  // ajuste aqui a URL do seu endpoint:
  private endpoint = '/api/places';

  daysOfWeek: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ];

  form: FormGroup = this.fb.group({
    label: ['', Validators.required],
    location: ['', Validators.required],
    days: this.fb.array<FormGroup>([], { validators: [daysNoOverlapValidator] })
  });

  get days(): FormArray<FormGroup> {
    return this.form.get('days') as FormArray<FormGroup>;
  }

  constructor() {
    // começa com uma faixa exemplo
    this.addDay();
  }

  private buildDay(): FormGroup {
    const group = this.fb.group(
      {
        dayOfWeek: ['wednesday', Validators.required],
        startTime: ['11:30', Validators.required],
        endTime: ['15:00', Validators.required],
        type: ['OPEN', Validators.required]
      },
      { validators: [dayRangeValidator] }
    );

    // Revalida overlaps quando algum campo muda
    group.valueChanges.subscribe(() =>
      this.days.updateValueAndValidity({ onlySelf: true })
    );

    return group;
  }

  addDay() {
    this.days.push(this.buildDay());
  }
  removeDay(i: number) {
    this.days.removeAt(i);
    this.days.updateValueAndValidity(); // reavalia overlaps
  }

  reset() {
    this.form.reset();
    this.days.clear();
    this.addDay();
  }

  payload(): PlacePayload {
    const raw = this.form.getRawValue();
    return {
      label: raw.label ?? '',
      location: raw.location ?? '',
      days: (raw.days ?? []).map((d: any) => ({
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        type: d.type
      })) as DayItem[]
    };
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('Há erros no formulário. Verifique os horários.', 'Fechar', {
        duration: 3000
      });
      return;
    }

    const body = this.payload();
    this.http.post<unknown>(this.endpoint, body).subscribe({
      next: () =>
        this.snack.open('Salvo com sucesso!', 'Fechar', { duration: 3000 }),
      error: (err) => {
        console.error(err);
        this.snack.open('Falha ao salvar. Verifique o console.', 'Fechar', {
          duration: 4000
        });
      }
    });
  }
}
