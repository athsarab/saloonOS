export const feedback = {
  auth: {
    signInFailed: 'Email or password is incorrect. If you registered recently, verify your email first.',
    sessionSaveFailed: 'You were signed in, but this device could not save the session securely. Close and reopen the app, then try again.',
    resetEmailFailed: 'We could not send the reset email. Check the address and try again.',
    resetFailed: 'We could not reset your password. Check the code and try again.',
    resetExpired: 'This reset link is invalid, expired, or already used. Request a new one.',
    verificationFailed: 'The email or code is incorrect, expired, or already used.',
    verificationSent: 'If this email belongs to an unverified account, a new code is on its way. Check your spam folder too.',
  },
  appointment: {
    loadFailed: 'We could not load appointments. Try again.',
    saveFailed: 'We could not save the appointment. Check the time and staff availability.',
    conflict: 'That time is unavailable. Choose another time or staff member.',
  },
  payment: {
    offline: 'Payments need a live connection. Use Offline cash only after preparing an authorized session.',
    quoteFailed: 'We could not calculate the payment. Check the cart and try again.',
    confirmationPending: 'Payment confirmation was not received. Keep this cart and retry the same payment. Do not create another sale.',
    shareFailed: 'The sale is saved, but the receipt could not be shared. You can share it from Sales.',
    pricesRefreshed: 'Prices refreshed. Review the total before payment.',
    shiftOpened: 'Cash shift opened.',
    shiftClosed: (difference: string) => `Shift closed. Difference: ${difference}`,
  },
  refund: {
    offline: 'Refunds need a live connection. Do not pay out cash while offline.',
    recorded: 'Refund recorded. Stock is unchanged; handle product returns separately.',
    confirmationPending: 'Refund confirmation was not received. Retry with the same amount and reference.',
  },
  offline: {
    saved: 'Cash saved on this device. The receipt is provisional until the server confirms it.',
    notSaved: 'Cash was not saved. Do not collect payment again until storage confirms the sale.',
    syncPending: 'Sale saved on this device. Waiting to sync.',
    syncConfirmed: 'Sale confirmed by the server.',
    syncFailed: 'Sale is still saved on this device. Synchronization will retry when the connection returns.',
    shareFailed: 'The receipt is saved, but it could not be shared. Try again from Offline & sync.',
  },
  permission: 'You do not have permission to do this. Ask an owner or manager.',
  network: 'We could not connect to SalonOS. Check your connection and try again.',
  retry: 'Something went wrong. Try again.',
} as const;

type ErrorOptions = {
  fallback?: string;
  byStatus?: Partial<Record<number, string>>;
};

export function feedbackError(error: unknown, options: ErrorOptions = {}): string {
  const fallback = options.fallback ?? feedback.retry;
  if (isApiError(error)) {
    if (error.status && options.byStatus?.[error.status]) return options.byStatus[error.status]!;
    if (error.status === 401) return 'Your session has expired. Sign in again to continue.';
    if (error.status === 403) return feedback.permission;
    if (error.status === 408) return 'The request took too long. Check your connection and try again.';
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (error.status && error.status >= 500) return 'SalonOS could not complete this request. Try again shortly.';
    if (error.status && error.status >= 400 && error.message && !/^Request failed with status/.test(error.message)) return sentence(error.message);
    return fallback;
  }
  if (error instanceof Error && error.message && !/^(Network request failed|Failed to fetch|AbortError)/i.test(error.message)) return sentence(error.message);
  return feedback.network;
}

function isApiError(error: unknown): error is { status?: number; message: string } {
  return typeof error === 'object' && error !== null && 'status' in error && 'message' in error;
}

function sentence(value: string) {
  const text = value.charAt(0).toUpperCase() + value.slice(1).trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
