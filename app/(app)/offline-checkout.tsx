import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Screen } from '../../src/components/ui';
import { PosSheet } from '../../src/components/PosSheet';
import { AppHeader } from '../../src/components/AppHeader';
import { useTheme } from '../../src/theme/ThemeProvider';
import { previewOfflineCash, recordOfflineCash, useOffline } from '../../src/offline/runtime';
import type { OfflineOperation } from '../../src/offline/types';
import type { CheckoutRequest } from '../../src/lib/checkout-api';
import { cents, decimal, lkr } from '../../src/lib/money';
import { shareReceipt } from '../../src/lib/receipt';
import { feedback, feedbackError } from '../../src/lib/feedback';
import { layout, radius, spacing, type } from '../../src/theme/tokens';

export default function OfflineCashScreen() {
  const state = useOffline(), snapshot = state.snapshot;
  const { colors } = useTheme();
  const [search, setSearch] = useState(''), [cash, setCash] = useState(''), [message, setMessage] = useState('');
  const [cart, setCart] = useState<{ itemId: string; quantity: number; staffId?: string }[]>([]);
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [saved, setSaved] = useState<OfflineOperation | null>(null);
  const inFlight = useRef(false);
  if (!snapshot || state.locked) return <Screen><View style={styles.content}><Text>Prepare an authorized offline session in Sync Status before taking cash.</Text><Button label="Open Sync Status" onPress={() => router.replace('/(app)/sync')} /></View></Screen>;
  const total = cart.reduce((sum, line) => sum + cents(snapshot.catalog.find(item => item.id === line.itemId)?.priceLkr ?? '0') * BigInt(line.quantity), 0n);
  const payload = (): CheckoutRequest => ({ branchId: snapshot.branch.id, paymentMethod: 'CASH', discountLkr: '0', cashReceivedLkr: decimal(cents(cash)), expectedTotalLkr: decimal(total), items: cart.map(line => ({ itemId: line.itemId, quantity: String(line.quantity), assignedStaffProfileId: line.staffId, expectedUnitPriceLkr: snapshot.catalog.find(item => item.id === line.itemId)?.priceLkr ?? '0' })) });
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const operation = await recordOfflineCash(payload());
      setSaved(operation); setCart([]); setCash(''); setReview(false);
    } catch (error) { setMessage(feedbackError(error, { fallback: feedback.offline.notSaved })); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const chip = (label: string, action: () => void) => <Pressable key={label} style={[styles.chip, { backgroundColor: colors.primarySoft }]} onPress={action} accessibilityRole="button"><Text style={{ color: colors.text }}>{label}</Text></Pressable>;
  return <Screen><SafeAreaView style={styles.flex} edges={['top']}>
    <FlatList data={snapshot.catalog.filter(item => (item.name + ' ' + (item.category ?? '')).toLowerCase().includes(search.toLowerCase()))} keyExtractor={item => item.id} contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.gap}>
        <AppHeader back fallbackHref="/(app)/sync" title="Offline cash till" />
        <Text style={{ color: colors.accent }}>LOCAL RECORDING / receipts are provisional until synchronized.</Text>
        <Text style={{ color: colors.text }}>{snapshot.branch.name} / walk-in / cash only</Text>
        <Text style={{ color: colors.textMuted }}>Catalog valid until {new Date(snapshot.catalogExpiresAt).toLocaleTimeString()}. No refunds, transfers or discounts offline.</Text>
        <Button label="Sync Status and queue" variant="secondary" onPress={() => router.push('/(app)/sync')} />
        {saved ? <Card><Text style={[type.bodyStrong, { color: colors.primary }]}>{feedback.offline.saved}</Text><Text selectable style={{ color: colors.text }}>LOCAL-{saved.operationId}</Text><Text style={{ color: colors.text }}>Do not collect the cash again. The final invoice is pending server confirmation.</Text><Button label="Share provisional receipt" onPress={() => void shareReceipt(saved.provisionalReceipt).catch(() => setMessage(feedback.offline.shareFailed))} /><Button label="Next customer" variant="secondary" onPress={() => setSaved(null)} /></Card> : null}
        <Field label="Search cached items or categories" value={search} onChangeText={setSearch} />
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" disabled={busy || !!saved} style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setCart(current => current.some(line => line.itemId === item.id) ? current.map(line => line.itemId === item.id ? { ...line, quantity: Math.min(999999, line.quantity + 1) } : line) : [...current, { itemId: item.id, quantity: 1, staffId: item.type === 'SERVICE' && snapshot.staff.length === 1 ? snapshot.staff[0].id : undefined }])}>
        <Text style={[styles.heading, { color: colors.text }]}>{item.name}</Text><Text style={{ color: colors.textMuted }}>{item.type} / {item.category}</Text><Text style={{ color: colors.primary }}>{lkr(item.priceLkr)}</Text>
      </Pressable>}
      ListFooterComponent={<View style={styles.gap}>
        {cart.map(line => <Card key={line.itemId}>
          <Text style={{ color: colors.text }}>{snapshot.catalog.find(item => item.id === line.itemId)?.name} x {line.quantity}</Text>
          <View style={styles.wrap}>{chip('Remove one ' + line.itemId.slice(0, 4), () => setCart(current => current.map(value => value.itemId === line.itemId ? { ...value, quantity: value.quantity - 1 } : value).filter(value => value.quantity > 0)))}{chip('Add one ' + line.itemId.slice(0, 4), () => setCart(current => current.map(value => value.itemId === line.itemId ? { ...value, quantity: Math.min(999999, value.quantity + 1) } : value)))}</View>
          {snapshot.catalog.find(item => item.id === line.itemId)?.type === 'SERVICE' ? <View style={styles.wrap}>{snapshot.staff.map(staff => chip((line.staffId === staff.id ? 'Assigned: ' : '') + staff.user.displayName, () => setCart(current => current.map(value => value.itemId === line.itemId ? { ...value, staffId: staff.id } : value))))}</View> : null}
        </Card>)}
        <Text style={[styles.heading, { color: colors.text }]}>Cached total {lkr(decimal(total))}</Text>
        <Field label="Cash received (LKR)" value={cash} onChangeText={setCash} keyboardType="decimal-pad" />
        <Button label="Review local cash receipt" disabled={!cart.length || busy || !!saved} onPress={() => void (async () => { setBusy(true); try { await previewOfflineCash(payload()); setMessage(''); setReview(true); } catch (error) { setMessage(feedbackError(error, { fallback: 'Cash cannot be authorized locally. Check the cart and try again.' })); } finally { setBusy(false); } })()} />
        {message ? <Text style={{ color: colors.danger }}>{message}</Text> : null}
      </View>}
    />
    <PosSheet visible={review} title="Record offline cash" locked={busy} onClose={() => setReview(false)}>
      <Text style={{ color: colors.text }}>Cash collected: {lkr(decimal(total))}</Text>
      <Text style={{ color: colors.text }}>Final totals remain subject to server price, stock, shift and authorization checks. This action saves a provisional cash record, not a final invoice.</Text>
      <Button label="Confirm cash and save on device" loading={busy} onPress={() => void confirm()} />
      {message ? <Text style={{ color: colors.danger }}>{message}</Text> : null}
    </PosSheet>
  </SafeAreaView></Screen>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: layout.screenBottomInset },
  gap: { gap: spacing.lg },
  title: { ...type.title },
  heading: { ...type.heading },
  item: { padding: spacing.lg, minHeight: 100, borderWidth: 1, borderRadius: radius.lg, gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { padding: spacing.md, minHeight: 48, borderRadius: radius.md },
});
