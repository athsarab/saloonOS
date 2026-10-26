import { cents, decimal, lkr } from '../../../src/lib/money';

describe('Mobile money display uses integer minor units', () => {
  it('adds decimal amounts exactly and preserves trailing zeros', () => {
    expect(decimal(cents('0.10') + cents('0.20'))).toBe('0.30');
    expect(decimal(cents('19.99') * 3n)).toBe('59.97');
    expect(decimal(cents('200') - cents('139.74'))).toBe('60.26');
    expect(lkr('1234567.80')).toBe('LKR 1,234,567.80');
  });
  it('rejects overprecision, scientific notation, negative and nonnumeric inputs', () => {
    for (const value of ['NaN', '-1', '1e3', '0.001', '']) expect(() => cents(value)).toThrow();
  });
});
