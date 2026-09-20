import { PlaceResponse } from '../models/place.model';

/**
 * Consecutive days that share the same schedule, rendered as one line:
 * `Mon – Fri  11:30–14:00, 18:30–22:00`.
 */
export interface OpeningGroup {
  /** e.g. "Mon – Fri" or "Sat". */
  days: string;
  /** e.g. "11:30–14:00, 18:30–22:00", or empty when the group is closed. */
  intervals: string;
  closed: boolean;
}

/** A place plus its precomputed weekly view — one table row. */
export interface PlaceRow {
  place: PlaceResponse;
  groups: OpeningGroup[];
}
