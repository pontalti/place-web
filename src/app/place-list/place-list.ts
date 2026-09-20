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
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, filter, finalize, switchMap } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { environment } from '../../environments/environment';
import { isApiError } from '../models/api-error.model';
import { Page, PageQuery, SortDirection } from '../models/page.model';
import { DayOfWeek, DayResponse, PlaceResponse } from '../models/place.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../shared/confirm-dialog';
import { OpeningGroup, PlaceRow } from './place-list.types';

/** Same default as the backend's @PageableDefault(size = 20, sort = "label"). */
const DEFAULT_QUERY: PageQuery = { page: 0, size: 20, sort: 'label', direction: 'asc' };

/** Week order used to group the opening hours; must start on Monday. */
const WEEK_ORDER: readonly DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

@Component({
  selector: 'app-place-list',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressBarModule
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './place-list.scss',
  templateUrl: './place-list.html'
})
export class PlaceListComponent {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // API base, version included, comes from the environment — same as PlaceFormComponent.
  private readonly endpoint = `${environment.apiUrl}/place`;

  readonly displayedColumns = ['id', 'label', 'location', 'days', 'edit', 'delete'] as const;
  readonly pageSizeOptions = [10, 20, 50, 100];

  /** Rows of the current page, as they come from the backend. */
  readonly places = signal<PlaceResponse[]>([]);
  /** Total across all pages — drives the paginator's length. */
  readonly total = signal(0);
  /** Current query; the paginator and the sort headers are bound to it. */
  readonly query = signal<PageQuery>(DEFAULT_QUERY);
  /** true while a request is in flight. */
  readonly loading = signal(false);
  /** Id being deleted, so only that row's button shows the pending state. */
  readonly deletingId = signal<number | null>(null);

  /**
   * What the table renders. The weekly grouping is computed once per response
   * instead of from a template method, which would rerun it on every change
   * detection pass.
   */
  readonly rows = computed<PlaceRow[]>(() =>
    this.places().map((place) => ({ place, groups: this.groupOpeningHours(place) }))
  );

  /**
   * Every page, size or sort change goes through this subject. switchMap
   * cancels the request still in flight, so paging quickly through the table
   * can never let an older, slower response overwrite a newer one.
   */
  private readonly reload$ = new Subject<void>();

  constructor() {
    this.reload$
      .pipe(
        switchMap(() => {
          // Set here rather than in a tap before switchMap: switchMap
          // unsubscribes the previous request first, and that request's
          // finalize would otherwise switch the indicator back off.
          this.loading.set(true);
          return this.fetchPage(this.query()).pipe(
            catchError((err: unknown) => {
              console.error(err);
              this.snack.open(this.toErrorMessage(err), 'Close', { duration: 5000 });
              return EMPTY;
            }),
            finalize(() => this.loading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((page) => this.applyPage(page));

    /*
     * Browser only. During SSR, HttpClient would resolve the relative /api URL
     * against the Node server, which does not proxy it; the request would fail
     * there and the browser would fetch the same page again after hydration
     * anyway.
     */
    afterNextRender(() => this.reload());
  }

  // --- PUBLIC COMPONENT METHODS ---

  reload(): void {
    this.reload$.next();
  }

  onPage(event: PageEvent): void {
    this.query.update((q) => ({ ...q, page: event.pageIndex, size: event.pageSize }));
    this.reload();
  }

  /** A new order makes the current page index meaningless, so it goes back to the first. */
  onSort(sort: Sort): void {
    const direction: SortDirection = sort.direction === 'desc' ? 'desc' : 'asc';
    this.query.update((q) => ({ ...q, page: 0, sort: sort.active, direction }));
    this.reload();
  }

  /**
   * Asks for confirmation, then deletes.
   *
   * <p>The dialog is what makes this safe: the row disappears for good, and a
   * misplaced click on an icon button in a dense table is easy.
   *
   * <p>The backend answers 204 with no body, so nothing is parsed. The page is
   * loaded again instead of being patched in memory: the row that moves up
   * from the next page can only come from the server, and the total has to be
   * refreshed anyway.
   */
  confirmDelete(place: PlaceResponse): void {
    const data: ConfirmDialogData = {
      title: 'Delete place',
      message: `Delete "${place.label}" and its opening hours? This cannot be undone.`,
      confirmLabel: 'Delete'
    };

    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, true>(ConfirmDialogComponent, {
        data,
        width: '420px'
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => {
          this.deletingId.set(place.id);
          return this.http.delete<void>(`${this.endpoint}/${place.id}`).pipe(
            catchError((err: unknown) => {
              console.error(err);
              this.snack.open(this.toDeleteErrorMessage(err, place), 'Close', {
                duration: 5000
              });
              return EMPTY;
            }),
            finalize(() => this.deletingId.set(null))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.snack.open(`"${place.label}" deleted.`, 'Close', { duration: 3000 });
        this.reload();
      });
  }

  // --- PRIVATE METHODS ---

  /**
   * Always sends `page`: the Spring controller routes on that parameter, and
   * without it the request lands on the unpaged handler that returns a plain
   * array.
   */
  private fetchPage(query: PageQuery): Observable<Page<PlaceResponse>> {
    const params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sort', `${query.sort},${query.direction}`);

    return this.http.get<Page<PlaceResponse>>(this.endpoint, { params });
  }

  private applyPage(page: Page<PlaceResponse>): void {
    /*
     * The index can fall past the end when rows were removed since the last
     * load (Spring answers with an empty page and the real total). Step back
     * to the last page that exists instead of showing an empty table.
     */
    if (page.content.length === 0 && page.number > 0 && page.totalPages > 0) {
      this.query.update((q) => ({ ...q, page: page.totalPages - 1 }));
      this.reload();
      return;
    }

    this.places.set(page.content);
    this.total.set(page.totalElements);
  }

  /**
   * Condenses the slots into the weekly view, the same shape the backend's
   * grouped endpoint returns: one line per run of days sharing a schedule.
   *
   * <p>Listing every slot on its own line made a row with lunch and dinner
   * service ten lines tall. Here the same place reads as
   * `Mon – Fri 11:30–14:00, 18:30–22:00`.
   *
   * <p>Grouping is by adjacency, not by value: only neighbouring days are
   * merged, so a label never spans a day that has different hours. The
   * backend's version groups by value, which is why the two can label the same
   * place differently.
   */
  private groupOpeningHours(place: PlaceResponse): OpeningGroup[] {
    const byDay = this.intervalsByDay(place.days);
    const groups: { first: DayOfWeek; last: DayOfWeek; intervals: string }[] = [];

    for (const day of WEEK_ORDER) {
      const intervals = (byDay.get(day) ?? []).join(', ');
      const previous = groups.at(-1);

      if (previous?.intervals === intervals) {
        previous.last = day;
        continue;
      }
      groups.push({ first: day, last: day, intervals });
    }

    return groups.map((group) => ({
      days:
        group.first === group.last
          ? this.shortDay(group.first)
          : `${this.shortDay(group.first)} – ${this.shortDay(group.last)}`,
      intervals: group.intervals,
      closed: group.intervals === ''
    }));
  }

  /** Open slots per day, as `HH:mm–HH:mm`, in chronological order. */
  private intervalsByDay(days: DayResponse[]): Map<DayOfWeek, string[]> {
    const byDay = new Map<DayOfWeek, string[]>();

    for (const day of days) {
      if (day.type === 'CLOSED') {
        continue;
      }
      /*
       * The backend sends the enum name in upper case (WEDNESDAY) while the
       * model — shared with the form's select — uses lower case.
       */
      const key = day.dayOfWeek.toLowerCase() as DayOfWeek;
      const interval = `${day.startTime.slice(0, 5)}–${day.endTime.slice(0, 5)}`;
      const bucket = byDay.get(key);
      if (bucket === undefined) {
        byDay.set(key, [interval]);
      } else {
        bucket.push(interval);
      }
    }

    // "11:30–14:00" sorts before "18:30–22:00" as text: zero-padded HH:mm.
    byDay.forEach((intervals) => intervals.sort());
    return byDay;
  }

  /** "monday" as "Mon". */
  private shortDay(day: DayOfWeek): string {
    return day.charAt(0).toUpperCase() + day.slice(1, 3);
  }

  /** Same translation as in PlaceFormComponent; see the comments there. */
  private toErrorMessage(err: unknown, action = 'loading'): string {
    if (!(err instanceof HttpErrorResponse)) {
      return `Unexpected error while ${action}.`;
    }

    if (err.status === 0) {
      return 'No connection to the server.';
    }

    const body: unknown = err.error;
    if (isApiError(body)) {
      const details = body.details?.length ? ` (${body.details.join('; ')})` : '';
      return `${body.message}${details}`;
    }

    return `Failed while ${action} (HTTP ${err.status}).`;
  }

  /**
   * A 404 here means someone else already removed the row, which is not really
   * a failure: the list is reloaded so it catches up.
   */
  private toDeleteErrorMessage(err: unknown, place: PlaceResponse): string {
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.reload();
      return `"${place.label}" no longer exists.`;
    }
    return this.toErrorMessage(err, 'deleting the place');
  }
}
