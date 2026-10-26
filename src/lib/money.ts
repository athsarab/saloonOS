// Money stays in integer minor units on the client. The server owns final totals.
export function cents(value: string): bigint {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter a valid amount with at most two decimals.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function decimal(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return sign + (absolute / 100n).toString() + '.' + (absolute % 100n).toString().padStart(2, '0');
}
export function lkr(value: string): string {
  const [whole, fraction = '00'] = value.split('.');
  return 'LKR ' + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction.padEnd(2, '0');
}
