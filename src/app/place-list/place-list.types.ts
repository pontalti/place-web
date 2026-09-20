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

/**
 * Body of a partial update: the id plus only the fields that changed.
 *
 * <p>`days` is deliberately absent. The backend's applyDayPatches merges
 * rather than replaces — a slot the payload omits stays in the database, and
 * slots sent without an id are appended — so the opening hours are edited
 * through the form's PUT, never from here.
 */
export interface PlacePatch {
  id: number;
  label?: string;
  location?: string;
}

/** A place plus its precomputed weekly view — one table row. */
export interface PlaceRow {
  place: PlaceResponse;
  groups: OpeningGroup[];
}
