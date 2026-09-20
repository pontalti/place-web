import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { PlaceResponse } from '../models/place.model';

/**
 * Which field the dialog opens focused on — the cell the user clicked.
 *
 * The CDK looks for a `cdkFocusInitial` attribute, not a directive input, so
 * it is bound with `attr.` and removed by binding null on the other field.
 */
export type QuickEditField = 'label' | 'location';

export interface QuickEditDialogData {
  place: PlaceResponse;
  focus: QuickEditField;
}

/** What the dialog closes with; the caller works out what actually changed. */
export interface QuickEditResult {
  label: string;
  location: string;
}

/**
 * Edits the two scalar fields of a place without leaving the list.
 *
 * <p>The opening hours are not here on purpose: they carry the overlap rules
 * and belong to the full form. This dialog exists for the common case of
 * fixing a name or an address, which is what the backend's PATCH is for.
 */
@Component({
  selector: 'app-place-quick-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 8px;
      min-width: 320px;
    }
  `,
  template: `
    <h2 mat-dialog-title>Edit place #{{ data.place.id }}</h2>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <div class="fields">
          <mat-form-field appearance="outline">
            <mat-label>Label</mat-label>
            <input
              matInput
              formControlName="label"
              required
              [attr.cdkFocusInitial]="data.focus === 'label' ? '' : null"
            />
            @if (form.controls.label.hasError('required')) {
              <mat-error>Required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Location</mat-label>
            <input
              matInput
              formControlName="location"
              required
              [attr.cdkFocusInitial]="data.focus === 'location' ? '' : null"
            />
            @if (form.controls.location.hasError('required')) {
              <mat-error>Required.</mat-error>
            }
          </mat-form-field>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">
          Continue
        </button>
      </mat-dialog-actions>
    </form>
  `
})
export class PlaceQuickEditDialogComponent {
  readonly dialogRef =
    inject<MatDialogRef<PlaceQuickEditDialogComponent, QuickEditResult>>(MatDialogRef);
  readonly data = inject<QuickEditDialogData>(MAT_DIALOG_DATA);

  readonly form = new FormGroup({
    label: new FormControl(this.data.place.label, {
      nonNullable: true,
      validators: [Validators.required]
    }),
    location: new FormControl(this.data.place.location, {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  /**
   * Closes with the typed values. Trimming happens here so the caller compares
   * what will actually be sent, not what was typed.
   */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { label, location } = this.form.getRawValue();
    this.dialogRef.close({ label: label.trim(), location: location.trim() });
  }
}
