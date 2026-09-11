import { FormArray, FormControl, FormGroup } from '@angular/forms';

import { DayOfWeek, DayType } from '../models/place.model';

/** Typed form for a single time slot. */
export type DayForm = FormGroup<{
  dayOfWeek: FormControl<DayOfWeek>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
  type: FormControl<DayType>;
}>;

/** Typed form for the place. */
export type PlaceForm = FormGroup<{
  label: FormControl<string>;
  location: FormControl<string>;
  days: FormArray<DayForm>;
}>;

/** Slot already normalized to minutes, used for overlap detection. */
export interface TimeSlot {
  start: number;
  end: number;
  group: DayForm;
}
