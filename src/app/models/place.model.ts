/**
 * Contracts for the Place resource, mirroring the backend records
 * (PlaceRecord / GroupedPlaceRecord).
 */

export type DayType = 'OPEN' | 'CLOSED';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Canonical day order, used by the form's select. */
export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;

// --- REQUEST: what the form sends. No `id`: the backend generates it. ---

export interface DayItem {
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  type: DayType;
}

export interface PlacePayload {
  label: string;
  location: string;
  days: DayItem[];
}

// --- RESPONSE: what the backend returns, with the persisted ids. ---

export interface DayResponse extends DayItem {
  id: number;
}

export interface PlaceResponse extends PlacePayload {
  id: number;
  days: DayResponse[];
}
