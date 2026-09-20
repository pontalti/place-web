import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

/** What the caller passes to {@link ConfirmDialogComponent}. */
export interface ConfirmDialogData {
  title: string;
  message: string;
  /** Label of the confirming button; defaults to "Confirm". */
  confirmLabel?: string;
}

/**
 * Yes/no dialog for actions that cannot be undone.
 *
 * <p>Closes with `true` when confirmed and with `undefined` on cancel, the
 * backdrop or Escape, so the caller only has to check for `true`.
 *
 * <p>Kept in `shared` because the edit screen will need the same prompt.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="warn" type="button" (click)="dialogRef.close(true)">
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject<MatDialogRef<ConfirmDialogComponent, true>>(MatDialogRef);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
