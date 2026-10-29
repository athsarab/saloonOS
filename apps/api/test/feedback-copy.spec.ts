import { feedback, feedbackError } from '../../../src/lib/feedback';

describe('mobile feedback copy', () => {
  it('maps permissions and server failures to actionable copy', () => {
    expect(feedbackError({ message: 'Forbidden', status: 403 })).toBe(feedback.permission);
    expect(feedbackError({ message: 'Internal error', status: 500 })).toContain('Try again shortly');
  });

  it('preserves explicit operation-specific messages', () => {
    expect(feedback.payment.confirmationPending).toContain('Do not create another sale');
    expect(feedback.offline.syncPending).not.toContain('confirmed');
    expect(feedback.offline.syncConfirmed).toContain('server');
  });

  it('does not expose transport errors as technical copy', () => {
    expect(feedbackError(new Error('Failed to fetch'))).toBe(feedback.network);
    expect(feedbackError(new Error('Quantity must be positive'))).toBe('Quantity must be positive.');
  });
});
