/**
 * One page of results as Spring Data serializes a `Page<T>`.
 *
 * Only the fields the UI reads are declared; the response also carries
 * `pageable`, `sort`, `numberOfElements` and `empty`, which are ignored.
 */
export interface Page<T> {
  content: T[];
  /** Total number of rows across all pages. */
  totalElements: number;
  totalPages: number;
  /** Zero-based index of this page. */
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

/** Sort direction accepted by Spring's `sort=property,direction` parameter. */
export type SortDirection = 'asc' | 'desc';

/** What the list asks the backend for. */
export interface PageQuery {
  /** Zero-based, as Spring expects. */
  page: number;
  size: number;
  sort: string;
  direction: SortDirection;
}
