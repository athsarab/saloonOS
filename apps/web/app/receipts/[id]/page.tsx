import { serverGet } from '../../../src/server-api';
import { lkr, Sale } from '../../../src/api';
import { notFound } from 'next/navigation';
import PrintButton from './print-button';
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const sale = await serverGet('/checkout/sales/' + id + '/receipt') as Sale | null;
  if (!sale) return <main className="receipt"><h1>Receipt unavailable</h1><p>Sign in again or check your branch access.</p><a href="/login">Sign in</a></main>;
  return <main className="receipt"><div className="no-print receipt-actions"><a href="/">Back to POS</a><PrintButton /></div><header><p className="eyebrow">SALONOS</p><h1>{sale.branchName}</h1><p>{sale.receiptNumber}</p><p>{new Date(sale.createdAt).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}</p><strong>{sale.status === 'OPEN' ? 'UNVERIFIED PAYMENT - NOT PAID' : sale.status}</strong><p>{sale.customerName ?? 'Walk-in customer'}</p></header><table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{sale.lines.map(l => <tr key={l.id}><td>{l.itemName}<small>{lkr(l.unitPriceLkr)} each ? {l.taxLabel}</small></td><td>{l.quantity}</td><td>{lkr(l.lineTotalLkr)}</td></tr>)}</tbody></table><dl><div><dt>Subtotal</dt><dd>{lkr(sale.subtotalLkr)}</dd></div><div><dt>Discount</dt><dd>{lkr(sale.discountLkr)}</dd></div><div><dt>Tax</dt><dd>{lkr(sale.taxLkr)}</dd></div><div className="total"><dt>Total</dt><dd>{lkr(sale.totalLkr)}</dd></div><div><dt>Refunded</dt><dd>{lkr(sale.refundedLkr)}</dd></div></dl>{sale.payments.map(p => <p key={p.id}>{p.method.replaceAll('_', ' ')} ? {p.status}<br />{p.reference}</p>)}<p className="receipt-thanks">Thank you for choosing us.<br />We look forward to seeing you again.</p></main>;
}
