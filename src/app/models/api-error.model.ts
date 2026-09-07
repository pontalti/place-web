/** Corpo de erro devolvido pelo @ExceptionHandler do backend. */
export interface ApiError {
  message: string;
  details?: string[];
}

/**
 * Type guard: confirma o formato do corpo de erro antes de usá-lo.
 * Necessário porque `HttpErrorResponse.error` é `any` — a checagem em
 * runtime é o que impede esse `any` de escapar para o resto do código.
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value).message === 'string'
  );
}
