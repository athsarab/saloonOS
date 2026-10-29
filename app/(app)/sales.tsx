import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownLeft, ChevronRight, ReceiptText } from 'lucide-react-native';
import { Button, Card, EmptyState, Field, Screen } from '../../src/components/ui';
import { PosSheet } from '../../src/components/PosSheet';
import { AppHeader } from '../../src/components/AppHeader';
import { ApiError } from '../../src/lib/api';
import { requestKey, useBranches, useCheckoutAccess, useDailyReport, useRefund, useSaleReceipt, useSalesHistory, useVerifyTransfer } from '../../src/lib/checkout-api';
import { cents, decimal, lkr } from '../../src/lib/money';
import { shareReceipt } from '../../src/lib/receipt';
import { feedback, feedbackError } from '../../src/lib/feedback';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useOffline } from '../../src/offline/runtime';
import { radius, spacing, type } from '../../src/theme/tokens';

type RefundAttempt = { saleId: string; amountLkr: string; reason: string; idempotencyKey: string };

export default function SalesScreen() {
  const { colors } = useTheme();
  const apiOnline = useOffline(state => state.apiOnline);
  const access = useCheckoutAccess(), branches = useBranches();
  const [branch, setBranch] = useState(''), [offset, setOffset] = useState(0);
  const branchId = branch || branches.data?.[0]?.id;
  const canReport = access.data?.permissions.includes('reports.read') ?? false;
  const canRefund = access.data?.permissions.includes('refunds') ?? false;
  const [date, setDate] = useState(''), [reportDate, setReportDate] = useState('');
  const sales = useSalesHistory(branchId, offset), report = useDailyReport(branchId, reportDate, canReport);
  const [selectedId, setSelectedId] = useState<string>();
  const detail = useSaleReceipt(selectedId);
  const sale = detail.data;
  const [mode, setMode] = useState<'receipt' | 'refund' | 'transfer'>('receipt');
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState<RefundAttempt | null>(null);
  const refund = useRefund(), verify = useVerifyTransfer();
  const inFlight = useRef(false);
  const busy = refund.isPending || verify.isPending;

  const confirmRefund = async () => {
    if (!apiOnline) { setMessage(feedback.refund.offline); return; }
    if (!sale || inFlight.current) return;
    inFlight.current = true;
    let payload = attempt;
    let sent = false;
    try {
      payload = attempt ?? { saleId: sale.id, amountLkr: decimal(cents(amount)), reason: reason.trim(), idempotencyKey: requestKey() };
      if (cents(payload.amountLkr) <= 0n || payload.reason.length < 3) throw new Error('Enter a positive amount and a reason with at least three characters.');
      setAttempt(payload);
      sent = true;
      await refund.mutateAsync(payload);
      setAttempt(null); setMode('receipt'); setMessage(feedback.refund.recorded);
    } catch (error) {
      if (!sent || (error instanceof ApiError && error.status && error.status < 500 && error.status !== 408)) {
        setAttempt(null);
        setMessage(feedbackError(error, { fallback: 'We could not record the refund. Check the amount and reason, then try again.' }));
      } else {
        setAttempt(payload);
        setMessage(feedback.refund.confirmationPending);
      }
    } finally { inFlight.current = false; }
  };
  const resolveTransfer = async (status: 'VERIFIED' | 'FAILED') => {
    if (!apiOnline) { setMessage('Bank verification needs a live connection. Try again when you are online.'); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    setMessage('');
    try {
      await verify.mutateAsync({ paymentId, status });
      setMode('receipt');
      setMessage(status === 'VERIFIED' ? 'Bank credit verified and payment confirmed.' : 'Transfer rejected. Reserved stock has been released.');
    } catch (error) { setMessage(feedbackError(error, { fallback: 'We could not update the transfer. Try the same action again.' })); }
    finally { inFlight.current = false; }
  };
  const close = () => { if (!busy) { setSelectedId(undefined); setMessage(''); setMode('receipt'); } };

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <FlatList
          data={sales.data?.items ?? []} keyExtractor={item => item.id} contentContainerStyle={styles.content}
          refreshing={sales.isFetching} onRefresh={() => { void sales.refetch(); if (canReport) void report.refetch(); }}
          ListHeaderComponent={<View style={styles.header}>
            <AppHeader back title={canReport ? 'Sales & reports' : 'Sales history'} />
            <View style={styles.wrap}>{(branches.data ?? []).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: branchId === item.id }} style={[styles.chip, { backgroundColor: branchId === item.id ? colors.primarySoft : colors.surfaceMuted }]} onPress={() => { setBranch(item.id); setOffset(0); }}><Text style={{ color: colors.text }}>{item.name}</Text></Pressable>)}</View>
            {access.isError || branches.isError ? <Button label="Retry access and branches" onPress={() => { void access.refetch(); void branches.refetch(); }} /> : null}
            {canReport ? <Card>
              <View style={styles.row}><Text style={[styles.subtitle, { color: colors.text }]}>Daily report</Text><ArrowDownLeft color={colors.primary} size={22} /></View>
              <Field label="Report date (YYYY-MM-DD)" placeholder="Leave empty for today" value={date} onChangeText={setDate} autoCapitalize="none" />
              <Button label="Show report" variant="secondary" onPress={() => setReportDate(date.trim())} />
              {report.isPending ? <ActivityIndicator color={colors.primary} /> : report.isError ? <><Text style={{ color: colors.danger }}>Could not load the report. Check the date and connection.</Text><Button label="Retry report" onPress={() => void report.refetch()} /></> : report.data ? <View style={styles.report}>
                <Text style={{ color: colors.textMuted }}>{report.data.date} / {report.data.timezone}</Text>
                <Text style={[styles.title, { color: colors.primary }]}>{lkr(report.data.netLkr)}</Text>
                <Text style={{ color: colors.textMuted }}>Net confirmed collections after refunds</Text>
                <View style={styles.row}><Text style={{ color: colors.text }}>Confirmed sales</Text><Text style={{ color: colors.text }}>{report.data.salesCount}</Text></View>
                <View style={styles.row}><Text style={{ color: colors.text }}>Gross sales</Text><Text style={{ color: colors.text }}>{lkr(report.data.grossLkr)}</Text></View>
                <View style={styles.row}><Text style={{ color: colors.text }}>Discounts</Text><Text style={{ color: colors.text }}>{lkr(report.data.discountsLkr)}</Text></View>
                <View style={styles.row}><Text style={{ color: colors.text }}>Collections</Text><Text style={{ color: colors.text }}>{lkr(report.data.collectedLkr)}</Text></View>
                <View style={styles.row}><Text style={{ color: colors.text }}>Refunds paid</Text><Text style={{ color: colors.text }}>{lkr(report.data.refundsLkr)}</Text></View>
                {Object.entries(report.data.payments).map(([method, value]) => <View style={styles.row} key={method}><Text style={{ color: colors.textMuted }}>{method.replace(/_/g, ' ')}</Text><Text style={{ color: colors.text }}>{lkr(value)}</Text></View>)}
                <Text style={{ color: colors.accent }}>{report.data.pendingCount} pending transfers excluded from collections.</Text>
              </View> : null}
            </Card> : <Text style={{ color: colors.textMuted }}>Daily reports and financial adjustments are available to owners and managers.</Text>}
            <Text style={[styles.subtitle, { color: colors.text }]}>Transaction history</Text>
            {sales.isError ? <><Text style={{ color: colors.danger }}>Sales could not be loaded.</Text><Button label="Retry sales" onPress={() => void sales.refetch()} /></> : null}
          </View>}
          ListEmptyComponent={sales.isPending && branchId ? <ActivityIndicator color={colors.primary} /> : !sales.isError ? <EmptyState title="No sales yet" description="Receipts will appear after your first checkout." /> : undefined}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={'View receipt ' + item.receiptNumber} onPress={() => { setSelectedId(item.id); setMode('receipt'); setMessage(''); }}
              style={[styles.sale, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ReceiptText color={colors.primary} size={24} />
              <View style={styles.grow}>
                <Text style={[styles.subtitle, { color: colors.text }]}>{lkr(item.totalLkr)}</Text>
                <Text numberOfLines={1} style={{ color: colors.textMuted }}>{item.receiptNumber}</Text>
                <Text style={{ color: item.status === 'OPEN' ? colors.accent : colors.textMuted }}>{item.status === 'OPEN' ? 'TRANSFER PENDING' : item.status}</Text>
                <Text style={{ color: colors.textMuted }}>{new Date(item.createdAt).toLocaleString('en-LK', { timeZone: branches.data?.find(value => value.id === branchId)?.timezone ?? 'Asia/Colombo' })}</Text>
              </View>
              <ChevronRight color={colors.textMuted} size={22} />
            </Pressable>
          )}
          ListFooterComponent={sales.data ? <View style={styles.pagination}>
            <Button label="Previous" variant="secondary" disabled={!offset} onPress={() => setOffset(value => Math.max(0, value - 20))} />
            <Text style={{ color: colors.textMuted }}>{offset + 1} / {sales.data.total || 0}</Text>
            <Button label="Next" variant="secondary" disabled={offset + 20 >= sales.data.total} onPress={() => setOffset(value => value + 20)} />
          </View> : undefined}
        />
      </SafeAreaView>

      <PosSheet visible={!!selectedId} title={mode === 'refund' ? 'Issue a refund' : mode === 'transfer' ? 'Review bank credit' : 'Receipt details'} onClose={close} locked={busy || !!attempt}>
        {detail.isPending ? <ActivityIndicator color={colors.primary} /> : detail.isError ? <Button label="Retry receipt" onPress={() => void detail.refetch()} /> : sale ? <>
          <Text selectable style={{ color: colors.textMuted }}>{sale.receiptNumber}</Text>
          {mode === 'receipt' ? <>
            <Text style={[styles.title, { color: colors.text }]}>{lkr(sale.totalLkr)}</Text>
            <Text style={{ color: sale.status === 'OPEN' ? colors.accent : colors.primary }}>{sale.status === 'OPEN' ? 'Awaiting independent bank verification. Not a confirmed payment.' : sale.status}</Text>
            {sale.lines.map(line => <View style={styles.row} key={line.id}><Text style={[styles.grow, { color: colors.text }]}>{line.itemName} x {line.quantity}</Text><Text style={{ color: colors.text }}>{lkr(line.lineTotalLkr)}</Text></View>)}
            <Text style={{ color: colors.textMuted }}>Discount {lkr(sale.discountLkr)} / Refunded {lkr(sale.refundedLkr)}</Text>
            {sale.payments.map(payment => <Card key={payment.id}>
              <Text style={{ color: colors.text }}>{payment.method.replace(/_/g, ' ')} / {payment.status}</Text>
              {payment.reference ? <Text selectable style={{ color: colors.textMuted }}>Reference: {payment.reference}</Text> : null}
              {canRefund && payment.method === 'BANK_TRANSFER' && payment.status === 'PENDING' ? <Button label="Review bank transfer" variant="secondary" onPress={() => { setPaymentId(payment.id); setMode('transfer'); setMessage(''); }} /> : null}
            </Card>)}
            <Button label="Share receipt" onPress={() => void shareReceipt(sale.receiptText).then(setMessage).catch(() => setMessage(feedback.payment.shareFailed))} />
            {canRefund && cents(sale.refundableLkr) > 0n ? <Button label="Partial or full refund" variant="secondary" onPress={() => { setAmount(''); setReason(''); setMode('refund'); setMessage(''); }} /> : null}
            {sale.refunds.map(value => <Text key={value.id} style={{ color: colors.textMuted }}>{lkr(value.amountLkr)} refunded: {value.reason}</Text>)}
          </> : mode === 'refund' ? <>
            <Text style={{ color: colors.text }}>Remaining confirmed payment: {lkr(sale.refundableLkr)}</Text>
            <Field label="Refund amount (LKR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!attempt && !busy} />
            <Field label="Reason for refund" value={reason} onChangeText={setReason} maxLength={255} editable={!attempt && !busy} />
            <Text style={{ color: colors.textMuted }}>This records money returned to the customer. Amount-only refunds do not automatically restock products. Cash refunds need an open shift.</Text>
            <Button label={attempt ? 'Retry refund safely' : 'Confirm refund paid'} disabled={!apiOnline} loading={refund.isPending} onPress={() => void confirmRefund()} />
            {!attempt ? <Button label="Cancel" variant="ghost" onPress={() => setMode('receipt')} /> : null}
          </> : <>
            <Text style={[styles.subtitle, { color: colors.text }]}>{lkr(sale.totalLkr)}</Text>
            <Text selectable style={{ color: colors.text }}>Reference: {sale.payments.find(payment => payment.id === paymentId)?.reference}</Text>
            <Text style={{ color: colors.textMuted }}>Check your bank account independently. Confirm only when the actual credit, reference, and amount match this sale.</Text>
            <Button label="Confirm bank credit verified" disabled={!apiOnline} loading={verify.isPending} onPress={() => void resolveTransfer('VERIFIED')} />
            <Button label="Reject transfer and release stock" variant="secondary" disabled={busy} onPress={() => void resolveTransfer('FAILED')} />
            <Button label="Keep pending" variant="ghost" disabled={busy} onPress={() => setMode('receipt')} />
          </>}
        </> : null}
        {message ? <Text style={{ color: colors.text }}>{message}</Text> : null}
      </PosSheet>
    </Screen>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }, header: { gap: spacing.lg, marginBottom: spacing.sm },
  eyebrow: { ...type.micro }, title: { ...type.title },
  subtitle: { ...type.heading }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 48, borderRadius: radius.pill, padding: spacing.md, justifyContent: 'center' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  report: { gap: spacing.md, paddingTop: spacing.lg }, sale: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.md },
});
