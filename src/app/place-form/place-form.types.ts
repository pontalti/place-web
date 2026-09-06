import { FormArray, FormControl, FormGroup } from '@angular/forms';

import { DayOfWeek, DayType } from '../models/place.model';

/** Formulário tipado de uma faixa de horário. */
export type DayForm = FormGroup<{
  dayOfWeek: FormControl<DayOfWeek>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
  type: FormControl<DayType>;
}>;

/** Formulário tipado do local. */
export type PlaceForm = FormGroup<{
  label: FormControl<string>;
  location: FormControl<string>;
  days: FormArray<DayForm>;
}>;

/** Faixa já normalizada em minutos, usada na detecção de conflitos. */
export interface TimeSlot {
  start: number;
  end: number;
  group: DayForm;
}
