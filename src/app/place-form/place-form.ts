import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal
} from '@angular/core';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { JsonPipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { environment } from '../../environments/environment';
import { isApiError } from '../models/api-error.model';
import {
  DAYS_OF_WEEK,
  DayItem,
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
    RouterLink,
    JsonPipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressBarModule
  ],
  templateUrl: './place-form.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './place-form.scss'
})
export class PlaceFormComponent {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // API base comes from the environment: /api in dev (through the proxy) and in production.
  private readonly endpoint = `${environment.apiUrl}/place`;

  readonly daysOfWeek = DAYS_OF_WEEK;

  /**
   * Id taken from the route: `null` on /place/new, a number on
   * /place/:id/edit. It is what decides between POST and PUT — the two modes
   * differ only in loading, the title, the verb and where they go afterwards,
   * which is not enough to justify a second copy of the opening-hours rules.
   */
  readonly placeId = signal<number | null>(null);
  readonly isEdit = computed(() => this.placeId() !== null);

  /** true while a POST or PUT is in flight — blocks duplicate submissions. */
  readonly saving = signal(false);
  /** true while the place being edited is being fetched. */
  readonly loading = signal(false);

  /**
   * Flipped after the first render. The GET must not run during SSR: the
   * relative /api URL would be resolved against the Node server, which does
   * not proxy it.
   */
  private rendered = false;

  /**
   * Stable identity for each slot, used by the @for `track`.
   * Without it, `track group` recreates the whole DOM whenever the array
   * is rebuilt (NG0956), and `track $index` misaligns validation errors
   * when a slot is removed from the middle of the list.
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

    // start with one sample slot
    this.addDay();

    /*
     * The parameter map, not a snapshot: the router reuses this component when
     * navigating straight from one edited place to another, and a snapshot
     * would keep showing the first one.
     */
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params.get('id');
      const parsed = raw === null ? Number.NaN : Number(raw);
      this.placeId.set(Number.isInteger(parsed) ? parsed : null);
      this.resetForm();
      this.loadPlace();
    });

    afterNextRender(() => {
      this.rendered = true;
      this.loadPlace();
    });
  }

  get days(): FormArray<DayForm> {
    return this.form.controls.days;
  }

  // --- PUBLIC COMPONENT METHODS ---

  addDay(): void {
    this.days.push(this.buildDay());
  }

  removeDay(index: number): void {
    this.days.removeAt(index);
    this.days.updateValueAndValidity(); // re-evaluate overlaps
  }

  /**
   * Clears a new place, or brings an edited one back to what the server has.
   */
  reset(): void {
    if (this.saving() || this.loading()) return;
    this.resetForm();
    this.loadPlace();
  }

  /** Clears the form without the `saving` guard — also used after the POST. */
  private resetForm(): void {
    this.form.reset();
    this.days.clear();
    this.addDay();
  }

  payload(): PlacePayload {
    // With the typed form, getRawValue() already returns the right shape:
    // no cast and no `any` are needed here.
    const { label, location, days } = this.form.getRawValue();
    return { label, location, days };
  }

  /**
   * What goes on the wire. On edit the id travels in the body, which is where
   * the backend reads it from, and the slots go without ids on purpose: the
   * PUT replaces the whole collection through `setDays`, and orphanRemoval
   * deletes whatever is no longer there. Sending ids would only invite
   * Hibernate to reuse rows the form no longer describes.
   */
  requestBody(): PlacePayload | (PlacePayload & { id: number }) {
    const id = this.placeId();
    return id === null ? this.payload() : { id, ...this.payload() };
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('The form has errors. Check the opening hours.', 'Close', {
        duration: 3000
      });
      return;
    }

    if (this.saving() || this.loading()) return; // guards against double click / repeated Enter

    const editing = this.isEdit();
    this.saving.set(true);

    this.request()
      .pipe(
        // finalize runs on success, error and cancellation
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          if (editing) {
            // Nothing left to do on this screen; the list shows the result.
            this.snack.open('Changes saved!', 'Close', { duration: 3000 });
            void this.router.navigate(['/place/grid']);
            return;
          }
          this.resetForm();
          this.snack.open('Saved successfully!', 'Close', { duration: 3000 });
        },
        error: (err: unknown) => {
          console.error(err);
          this.snack.open(this.toErrorMessage(err), 'Close', { duration: 5000 });
        }
      });
  }

  // --- PRIVATE METHODS AND VALIDATORS ---

  /** POST for a new place, PUT for an existing one. */
  private request(): Observable<PlaceResponse> {
    const id = this.placeId();
    if (id === null) {
      return this.http.post<PlaceResponse>(this.endpoint, this.requestBody());
    }
    return this.http.put<PlaceResponse>(this.endpoint, this.requestBody());
  }

  /** Loads the place being edited; does nothing while creating one. */
  private loadPlace(): void {
    const id = this.placeId();
    if (!this.rendered || id === null || this.loading()) return;

    this.loading.set(true);

    this.http
      .get<PlaceResponse>(`${this.endpoint}/${id}`)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (place) => this.fillForm(place),
        error: (err: unknown) => {
          console.error(err);
          this.snack.open(this.toErrorMessage(err), 'Close', { duration: 5000 });
          if (err instanceof HttpErrorResponse && err.status === 404) {
            // Editing something that is gone: back to the list.
            void this.router.navigate(['/place/grid']);
          }
        }
      });
  }

  /** Rebuilds the form from the loaded place. */
  private fillForm(place: PlaceResponse): void {
    this.form.patchValue({ label: place.label, location: place.location });

    this.days.clear();
    place.days.forEach((day) => this.days.push(this.buildDay(day)));

    // A place with no opening hours would otherwise leave an empty section.
    if (this.days.length === 0) {
      this.addDay();
    }

    this.days.updateValueAndValidity();
  }

  /**
   * Translates the error into a displayable message.
   * The parameter is `unknown` because RxJS does not guarantee the type:
   * besides HttpErrorResponse, any exception thrown in `next` or in an
   * interceptor lands here. The narrowing happens at runtime.
   */
  private toErrorMessage(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'Unexpected error while saving.';
    }

    if (err.status === 0) {
      return 'No connection to the server.';
    }

    // err.error is `any` on HttpErrorResponse — reassigning it to `unknown`
    // forces validation before use and keeps the `any` from escaping.
    const body: unknown = err.error;
    if (isApiError(body)) {
      const details = body.details?.length ? ` (${body.details.join('; ')})` : '';
      return `${body.message}${details}`;
    }

    return `Failed to save (HTTP ${err.status}).`;
  }

  /**
   * Builds a slot, empty with the sample values or filled from a loaded one.
   *
   * <p>The loaded values need normalizing: the backend serializes the enum in
   * upper case (WEDNESDAY) while the select's options are lower case, and a
   * LocalTime can arrive with seconds (11:30:00), which `input[type=time]`
   * refuses to display.
   */
  private buildDay(value?: DayItem): DayForm {
    const group: DayForm = new FormGroup(
      {
        dayOfWeek: new FormControl<DayOfWeek>(
          value === undefined ? 'wednesday' : (value.dayOfWeek.toLowerCase() as DayOfWeek),
          {
            nonNullable: true,
            validators: [Validators.required]
          }
        ),
        startTime: new FormControl(value?.startTime.slice(0, 5) ?? '11:30', {
          nonNullable: true,
          validators: [Validators.required]
        }),
        endTime: new FormControl(value?.endTime.slice(0, 5) ?? '15:00', {
          nonNullable: true,
          validators: [Validators.required]
        }),
        type: new FormControl<DayType>(value?.type ?? 'OPEN', {
          nonNullable: true,
          validators: [Validators.required]
        })
      },
      { validators: [(control) => this.dayRangeValidator(control)] }
    );

    this.dayIds.set(group, this.nextDayId++);

    // Re-validate overlaps whenever a field changes.
    // takeUntilDestroyed keeps the subscription from outliving the component.
    group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.days.updateValueAndValidity({ onlySelf: true }));

    return group;
  }

  /** Time helpers */
  private toMinutes(hhmm: string | null | undefined): number | null {
    const match = HHMM_PATTERN.exec(hhmm ?? '');
    if (match === null) return null;

    // Groups 1 and 2 always exist when the regex matches, but with
    // noUncheckedIndexedAccess that has to be proven to the compiler.
    const [, rawHours, rawMinutes] = match;
    if (rawHours === undefined || rawMinutes === undefined) return null;

    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    if (hours > 23 || minutes > 59) return null;

    return hours * 60 + minutes;
  }

  /** Treats "00:00" as 24:00 to represent end-of-day */
  private endToMinutes(hhmm: string | null | undefined): number | null {
    if (hhmm === '00:00') return 24 * 60;
    return this.toMinutes(hhmm);
  }

  /** Per-slot (group) validator — ensures start < end and not equal */
  private dayRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = this.toMinutes(group.get('startTime')?.value as string | null);
    const end = this.endToMinutes(group.get('endTime')?.value as string | null);
    if (start === null || end === null) return null; // required takes care of this
    return end <= start ? { range: true } : null;
  }

  /** Sets/clears the 'overlap' error on specific groups */
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

  /** Groups the valid slots by day of week, already converted to minutes */
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

  /** FormArray-level validator (all slots) — detects per-day overlaps */
  private daysNoOverlapValidator(array: AbstractControl): ValidationErrors | null {
    const controls = (array as FormArray<DayForm>).controls;

    // Clear previous marks
    for (const group of controls) {
      this.setGroupOverlapError(group, false);
    }

    let hasOverlap = false;

    for (const slots of this.groupSlotsByDay(controls).values()) {
      // Pairwise comparison: also covers the case of one slot fully
      // containing another, which the sequential scan used to miss.
      // Intervals are [start, end) — end == start is allowed (adjacent slots).
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
