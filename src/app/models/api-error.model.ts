/** Error body returned by the backend's @ExceptionHandler. */
export interface ApiError {
  message: string;
  details?: string[];
}

/**
 * Type guard: confirms the error body's shape before using it.
 * Needed because `HttpErrorResponse.error` is `any` — the runtime check
 * is what keeps that `any` from leaking into the rest of the code.
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  );
}
