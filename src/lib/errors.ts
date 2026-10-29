import { feedbackError } from './feedback';

type ErrorCopy = { fallback: string; byStatus?: Partial<Record<number, string>> };

/**
 * User-facing copy for a failed request. Never returns stack traces, tokens or server internals:
 * 5xx bodies are already replaced by `apiRequest`, and the API URL is only shown in development.
 */
export function friendlyError(error: unknown, { fallback, byStatus = {} }: ErrorCopy): string {
  return feedbackError(error, { fallback, byStatus });
}

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
