/**
 * Contratos do recurso Place, espelhando os records do backend
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

/** Ordem canônica dos dias, usada no select do formulário. */
export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;

// --- REQUEST: o que o formulário envia. Sem `id`: quem gera é o backend. ---

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

// --- RESPONSE: o que o backend devolve, já com os ids persistidos. ---

export interface DayResponse extends DayItem {
  id: number;
}

export interface PlaceResponse extends PlacePayload {
  id: number;
  days: DayResponse[];
}
