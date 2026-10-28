import { env } from '../config/env';
import { ApiError } from './api';

type ErrorCopy = { fallback: string; byStatus?: Partial<Record<number, string>> };

/**
 * User-facing copy for a failed request. Never returns stack traces, tokens or server internals:
 * 5xx bodies are already replaced by `apiRequest`, and the API URL is only shown in development.
 */
export function friendlyError(error: unknown, { fallback, byStatus = {} }: ErrorCopy): string {
  if (error instanceof ApiError) {
    if (error.status && byStatus[error.status]) return byStatus[error.status]!;
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (error.status && error.status >= 500) return 'The server couldn’t complete this request. Please try again shortly.';
    if (error.status === 403) return 'Your role doesn’t allow this action. Ask an owner or manager.';
    if (error.status && error.status >= 400 && error.message && !/^Request failed with status/.test(error.message)) return sentence(error.message);
    return fallback;
  }
  return __DEV__
    ? `Couldn’t reach the server at ${env.apiUrl}. Check that the API is running and this device is on the same network.`
    : 'Couldn’t reach SalonOS. Check your internet connection and try again.';
}

const sentence = (value: string) => {
  const text = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/.test(text) ? text : text + '.';
};

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
