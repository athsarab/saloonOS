import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus, ShoppingBag } from 'lucide-react-native';
import { Button, Card, EmptyState, Field, Screen } from '../../src/components/ui';
import { PosSheet } from '../../src/components/PosSheet';
import { ApiError } from '../../src/lib/api';
import { CatalogItem, CheckoutRequest, Quote, Sale, requestKey, useBranches, useCatalog, useCheckout, useCheckoutAccess, useCloseShift, useCurrentShift, useCustomers, useOpenShift, useQuote, useStaff } from '../../src/lib/checkout-api';
import { cents, decimal, lkr } from '../../src/lib/money';
import { shareReceipt } from '../../src/lib/receipt';
import { useTheme } from '../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import { useOffline } from '../../src/offline/runtime';

type CartLine = { item: CatalogItem; quantity: number; staffId?: string };
type Attempt = { payload: CheckoutRequest; idempotencyKey: string };

export default function CheckoutScreen() {
  const { colors } = useTheme();
  const offline = useOffline();
  const access = useCheckoutAccess(), branches = useBranches(), catalog = useCatalog();
  const [branch, setBranch] = useState('');
  const branchId = branch || branches.data?.[0]?.id;
  const staff = useStaff(branchId), shift = useCurrentShift(branchId);
  const [search, setSearch] = useState(''), [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false), [shiftMode, setShiftMode] = useState<'open' | 'close' | null>(null);
  const [customerSearch, setCustomerSearch] = useState(''), [customerId, setCustomerId] = useState<string>();
  const customers = useCustomers(customerSearch);
  const [discount, setDiscount] = useState('0'), [cash, setCash] = useState(''), [reference, setReference] = useState('');
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [quote, setQuote] = useState<Quote | null>(null), [attempt, setAttempt] = useState<Attempt | null>(null);
  const [completed, setCompleted] = useState<Sale | null>(null), [message, setMessage] = useState('');
  const [count, setCount] = useState(''), [shiftError, setShiftError] = useState('');
  const pay = useCheckout(), price = useQuote(), openShift = useOpenShift(), closeShift = useCloseShift();
  const inFlight = useRef(false);
  const canDiscount = access.data?.permissions.includes('discounts') ?? false;
  const locked = !!attempt || pay.isPending;
  const categories = useMemo(() => ['All', 'Services', 'Products', ...new Set((catalog.data ?? []).map(item => item.category).filter((value): value is string => !!value))], [catalog.data]);
  const items = useMemo(() => (catalog.data ?? []).filter(item =>
    (category === 'All' || (category === 'Services' && item.type === 'SERVICE') || (category === 'Products' && item.type === 'PRODUCT') || item.category === category) &&
    (item.name + ' ' + (item.category ?? '')).toLowerCase().includes(search.toLowerCase())), [catalog.data, search, category]);
  const estimated = useMemo(() => {
    try { return decimal(cart.reduce((sum, line) => sum + cents(line.item.priceLkr) * BigInt(line.quantity), 0n) - cents(discount || '0')); }
    catch { return null; }
  }, [cart, discount]);

  const edit = (action: () => void) => { if (!locked) { action(); setQuote(null); setMessage(''); } };
  const add = (item: CatalogItem) => edit(() => {
    setCart(current => {
      const existing = current.find(line => line.item.id === item.id);
      if (existing) return current.map(line => line === existing ? { ...line, quantity: Math.min(999999, line.quantity + 1) } : line);
      return [...current, { item, quantity: 1, staffId: item.type === 'SERVICE' && staff.data?.length === 1 ? staff.data[0].id : undefined }];
    });
  });
  const payload = (): CheckoutRequest => ({
    branchId: branchId!, customerId, discountLkr: decimal(cents(discount || '0')), paymentMethod: method,
    ...(method === 'CASH' ? { cashReceivedLkr: cash ? decimal(cents(cash)) : undefined } : { bankReference: reference.trim() }),
    items: cart.map(line => ({ itemId: line.item.id, quantity: String(line.quantity), assignedStaffProfileId: line.staffId, expectedUnitPriceLkr: line.item.priceLkr })),
  });
  const review = async () => {
    setMessage('');
    if (!offline.apiOnline) { setMessage('The API is unreachable. Use Offline cash checkout only after preparing an authorized session in Sync Status.'); return; }
    try {
      if (!cart.length || !branchId) throw new Error('Choose a branch and at least one item.');
      if (cart.some(line => line.item.type === 'SERVICE' && !line.staffId)) throw new Error('Assign a staff member to every service.');
      if (method === 'CASH' && !shift.data) throw new Error('Open a cash shift before taking cash.');
      if (method === 'BANK_TRANSFER' && !reference.trim()) throw new Error('Enter the bank transfer reference.');
      const next = await price.mutateAsync(payload());
      if (method === 'CASH' && (!cash || cents(cash) < cents(next.totalLkr))) throw new Error('Enter enough cash received to cover ' + lkr(next.totalLkr) + '.');
      setQuote(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not calculate the payment.'); }
  };
  const confirm = async () => {
    if (inFlight.current || (!quote && !attempt)) return;
    inFlight.current = true;
    try {
      const next = attempt ?? { payload: { ...payload(), expectedTotalLkr: quote!.totalLkr }, idempotencyKey: requestKey() };
      setAttempt(next);
      setMessage('');
      const sale = await pay.mutateAsync(next);
      setCompleted(sale); setCart([]); setAttempt(null); setQuote(null); setCash(''); setReference(''); setDiscount('0'); setCustomerId(undefined);
    } catch (error) {
      if (error instanceof ApiError && error.status && error.status >= 400 && error.status < 500 && error.status !== 408) {
        setAttempt(null); setQuote(null);
        setMessage(error.message);
      } else {
        setMessage('Payment confirmation was not received. Keep this cart and tap Retry safely to check the same request. Do not create another sale.');
      }
    } finally { inFlight.current = false; }
  };
  const saveShift = async () => {
    setShiftError('');
    try {
      if (!offline.apiOnline) throw new Error('Cash shifts can only be opened or closed while the API is reachable.');
      if (shiftMode === 'close' && offline.items.some(item => item.operation.checkout.branchId === branchId && item.state !== 'synchronized')) throw new Error('Reconcile and synchronize locally recorded cash before closing this shift.');
      const amount = decimal(cents(count));
      if (shiftMode === 'open') {
        await openShift.mutateAsync({ branchId: branchId!, openingAmountLkr: amount });
        setMessage('Cash shift opened.');
      } else {
        const closed = await closeShift.mutateAsync({ shiftId: shift.data!.id, closingAmountLkr: amount });
        setMessage('Shift closed. Difference: ' + lkr(closed.differenceLkr ?? '0.00'));
      }
      setShiftMode(null); setCount('');
    } catch (error) { setShiftError(error instanceof Error ? error.message : 'Could not save shift.'); }
  };
  const chip = (label: string, selected: boolean, action: () => void, disabled = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={action}
      style={[styles.chip, { backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted, borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.55 : 1 }]}>
      <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  if (access.isPending) return <Screen><View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.text }}>Loading checkout...</Text></View></Screen>;
  if (access.isError) return <Screen><View style={styles.center}><EmptyState title="Online checkout unavailable" description="Check your connection and make sure your role permits checkout." /><Button label="Authorized offline cash checkout" onPress={() => router.push('/(app)/offline-checkout')} /><Button label="Sync Status" variant="secondary" onPress={() => router.push('/(app)/sync')} /><Button label="Try online again" onPress={() => void access.refetch()} /></View></Screen>;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <FlatList
          data={items} numColumns={2} keyExtractor={item => item.id} columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
          refreshing={catalog.isFetching} onRefresh={() => { void catalog.refetch(); void shift.refetch(); }}
          ListHeaderComponent={<View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>SALONOS / POINT OF SALE</Text>
            <View style={styles.heading}><Text style={[styles.title, { color: colors.text }]}>A smooth checkout.</Text><ShoppingBag color={colors.primary} size={26} /></View>
            <Text style={{ color: colors.textMuted }}>Services, finishing touches, and a little care.</Text>
            <Button label="Offline cash and Sync Status" variant="secondary" onPress={() => router.push('/(app)/sync')} />
            <View style={styles.wrap}>{(branches.data ?? []).map(item => chip(item.name, branchId === item.id, () => { setBranch(item.id); setQuote(null); }, cart.length > 0 && branchId !== item.id))}</View>
            {branches.isError ? <Button label="Retry branches" onPress={() => void branches.refetch()} /> : !branches.isPending && !branches.data?.length ? <Text style={{ color: colors.danger }}>Create a branch in business settings before checkout.</Text> : null}
            <Card>
              {shift.isError ? <Button label="Retry cash shift" variant="secondary" onPress={() => void shift.refetch()} /> : shift.isPending ? <Text style={{ color: colors.textMuted }}>Checking cash shift...</Text> : <>
                <Text style={[styles.subtitle, { color: colors.text }]}>{shift.data ? 'Cash drawer is open' : 'Start your cash shift'}</Text>
                <Text style={{ color: colors.textMuted }}>{shift.data ? 'Expected cash ' + lkr(shift.data.expectedClosingLkr) : 'Count your opening float before taking cash.'}</Text>
                <Button label={shift.data ? 'Count and close shift' : 'Open cash shift'} variant="secondary" disabled={!branchId || locked} onPress={() => { setCount(''); setShiftError(''); setShiftMode(shift.data ? 'close' : 'open'); }} />
              </>}
            </Card>
            <Field label="Find an item" placeholder="Search services, products, or categories" value={search} onChangeText={setSearch} />
            <View style={styles.wrap}>{categories.map(value => chip(value, category === value, () => setCategory(value)))}</View>
            {catalog.isError ? <View style={styles.gap}><Text style={{ color: colors.danger }}>Could not load items. Checkout needs an online connection.</Text><Button label="Retry catalog" onPress={() => void catalog.refetch()} /></View> : null}
            {!cartOpen && message ? <Text style={{ color: colors.text }}>{message}</Text> : null}
          </View>}
          ListEmptyComponent={catalog.isPending ? <ActivityIndicator color={colors.primary} /> : !catalog.isError ? <EmptyState title="Nothing here yet" description="Try another search, or add items to the business catalog." /> : undefined}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={'Add ' + item.name + ', ' + lkr(item.priceLkr)} disabled={locked} onPress={() => add(item)}
              style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.itemIcon, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.primary, fontWeight: '800' }}>{item.type === 'SERVICE' ? 'S' : 'P'}</Text></View>
              <Text style={[styles.subtitle, { color: colors.text }]}>{item.name}</Text>
              <Text style={{ color: colors.textMuted }}>{item.category || (item.type === 'SERVICE' ? 'Service' : 'Product')}</Text>
              <Text style={[styles.price, { color: colors.primary }]}>{lkr(item.priceLkr)}</Text>
              {item.trackInventory ? <Text style={{ color: colors.textMuted }}>{item.stockQuantity} in stock</Text> : null}
              <Plus size={18} color={colors.primary} style={styles.itemPlus} />
            </Pressable>
          )}
        />
        <View style={[styles.cartBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text }}>{cart.reduce((sum, line) => sum + line.quantity, 0)} items{estimated ? ' / ' + lkr(estimated) : ''}</Text>
          <Button label={attempt ? 'Resolve payment' : 'View cart'} disabled={!cart.length} onPress={() => { setCompleted(null); setCartOpen(true); }} />
        </View>
      </SafeAreaView>

      <PosSheet visible={cartOpen} title={completed ? (completed.status === 'OPEN' ? 'Transfer recorded' : 'Payment received') : quote ? 'Confirm payment' : 'Your cart'} onClose={() => setCartOpen(false)} locked={pay.isPending}>
        {completed ? <>
          <View style={[styles.success, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.title, { color: colors.primary }]}>{lkr(completed.totalLkr)}</Text>
            <Text selectable style={{ color: colors.text }}>{completed.receiptNumber}</Text>
            <Text style={{ color: colors.textMuted }}>{completed.status === 'OPEN' ? 'Pending bank verification. This is not a confirmed payment.' : 'Cash received. Change: ' + lkr(completed.changeLkr ?? '0.00')}</Text>
          </View>
          <Button label="Share receipt" onPress={() => void shareReceipt(completed.receiptText).then(setMessage).catch(() => setMessage('Sharing failed. The sale is saved; share it from Sales.'))} />
          <Button label="Next customer" variant="secondary" onPress={() => { setCompleted(null); setCartOpen(false); setMessage(''); }} />
        </> : <>
          {cart.map(line => <View key={line.item.id} style={[styles.line, { borderColor: colors.border }]}>
            <Text style={[styles.subtitle, { color: colors.text }]}>{line.item.name}</Text>
            <View style={styles.heading}><Text style={{ color: colors.textMuted }}>{lkr(line.item.priceLkr)} each</Text><View style={styles.wrap}>
              <Pressable style={styles.quantity} accessibilityRole="button" accessibilityLabel={'Remove one ' + line.item.name} disabled={locked} onPress={() => edit(() => setCart(current => current.map(value => value.item.id === line.item.id ? { ...value, quantity: value.quantity - 1 } : value).filter(value => value.quantity > 0)))}><Minus color={colors.primary} size={20} /></Pressable>
              <Text style={[styles.quantityValue, { color: colors.text }]}>{line.quantity}</Text>
              <Pressable style={styles.quantity} accessibilityRole="button" accessibilityLabel={'Add one ' + line.item.name} disabled={locked} onPress={() => add(line.item)}><Plus color={colors.primary} size={20} /></Pressable>
            </View></View>
            {line.item.type === 'SERVICE' ? <><Text style={{ color: colors.textMuted }}>Assigned professional</Text><View style={styles.wrap}>{(staff.data ?? []).map(member => chip(member.user.displayName, line.staffId === member.id, () => edit(() => setCart(current => current.map(value => value.item.id === line.item.id ? { ...value, staffId: member.id } : value))), locked))}</View>{!staff.data?.length ? <Text style={{ color: colors.danger }}>Add an active staff profile for this branch before selling a service.</Text> : null}</> : null}
          </View>)}
          {staff.isError ? <Button label="Retry staff list" onPress={() => void staff.refetch()} /> : null}
          {!quote && !attempt ? <>
            <Field label="Customer search" placeholder="Name or phone" value={customerSearch} onChangeText={setCustomerSearch} />
            <View style={styles.wrap}>{chip('Walk-in customer', !customerId, () => edit(() => setCustomerId(undefined)))}{(customers.data ?? []).slice(0, 8).map(customer => chip(customer.firstName + ' ' + (customer.lastName ?? '') + (customer.phone ? ' / ' + customer.phone : ''), customerId === customer.id, () => edit(() => setCustomerId(customer.id))))}</View>
            {customers.isError ? <Button label="Retry customers" onPress={() => void customers.refetch()} /> : null}
            {canDiscount ? <Field label="Discount (LKR)" value={discount} onChangeText={value => edit(() => setDiscount(value))} keyboardType="decimal-pad" /> : <Text style={{ color: colors.textMuted }}>Discounts require a manager or owner.</Text>}
            <View style={styles.wrap}>{chip('Cash', method === 'CASH', () => edit(() => setMethod('CASH')))}{chip('Bank transfer', method === 'BANK_TRANSFER', () => edit(() => setMethod('BANK_TRANSFER')))}</View>
            {method === 'CASH' ? <Field label="Cash received (LKR)" value={cash} onChangeText={value => edit(() => setCash(value))} keyboardType="decimal-pad" placeholder="Enter amount received" /> : <><Field label="Bank transfer reference" value={reference} onChangeText={value => edit(() => setReference(value))} maxLength={120} /><Text style={{ color: colors.accent }}>Recorded as pending. A manager must independently verify the bank credit.</Text></>}
            <Text style={[styles.price, { color: colors.text }]}>{estimated ? 'Estimate ' + lkr(estimated) : 'Enter a valid discount.'}</Text>
            <Button label="Refresh cart prices" variant="secondary" onPress={() => void catalog.refetch().then(result => {
              if (!result.data) { setMessage('Could not refresh prices. Try again when connected.'); return; }
              const latest = new Map(result.data.map(item => [item.id, item]));
              edit(() => setCart(current => current.map(line => ({ ...line, item: latest.get(line.item.id) ?? line.item }))));
              setMessage('Prices refreshed. Review the total before payment.');
            })} />
            <Button label="Review payment" disabled={!cart.length || price.isPending} loading={price.isPending} onPress={() => void review()} />
          </> : <>
            <Card>
              <Text style={{ color: colors.textMuted }}>Confirmed by SalonOS</Text>
              <Text style={[styles.title, { color: colors.text }]}>{lkr(quote?.totalLkr ?? attempt!.payload.expectedTotalLkr!)}</Text>
              <Text style={{ color: colors.text }}>{method === 'CASH' ? 'Cash / received ' + lkr(cash) : 'Bank transfer / ' + reference}</Text>
              {method === 'CASH' && quote ? <Text style={{ color: colors.primary }}>Change {lkr(decimal(cents(cash) - cents(quote.totalLkr)))}</Text> : <Text style={{ color: colors.accent }}>Unverified transfer. No confirmed payment yet.</Text>}
            </Card>
            <Button label={attempt ? 'Retry safely' : method === 'CASH' ? 'Confirm cash received' : 'Record pending transfer'} onPress={() => void confirm()} loading={pay.isPending} />
            {!attempt ? <Button label="Edit cart" variant="secondary" onPress={() => setQuote(null)} /> : null}
          </>}
        </>}
        {message ? <Text style={{ color: colors.text }}>{message}</Text> : null}
      </PosSheet>

      <PosSheet visible={!!shiftMode} title={shiftMode === 'open' ? 'Open cash shift' : 'Close cash shift'} onClose={() => setShiftMode(null)} locked={openShift.isPending || closeShift.isPending}>
        <Text style={{ color: colors.textMuted }}>{shiftMode === 'open' ? 'Count the starting cash in the drawer.' : 'Count all cash in the drawer, including the opening float.'}</Text>
        {shiftMode === 'close' && shift.data ? <Text style={[styles.price, { color: colors.text }]}>Expected {lkr(shift.data.expectedClosingLkr)}</Text> : null}
        <Field label={shiftMode === 'open' ? 'Opening cash (LKR)' : 'Counted closing cash (LKR)'} value={count} onChangeText={setCount} keyboardType="decimal-pad" />
        {shiftError ? <Text style={{ color: colors.danger }}>{shiftError}</Text> : null}
        <Button label={shiftMode === 'open' ? 'Open shift' : 'Confirm closing count'} loading={openShift.isPending || closeShift.isPending} onPress={() => void saveShift()} />
      </PosSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, center: { flex: 1, padding: 24, justifyContent: 'center', gap: 18 },
  list: { padding: 20, paddingBottom: 32 }, columns: { gap: 12 }, header: { gap: 18, marginBottom: 20 },
  eyebrow: { fontWeight: '700', fontSize: 11, letterSpacing: 2 }, title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subtitle: { fontSize: 16, fontWeight: '700' }, price: { fontSize: 18, fontWeight: '800', marginVertical: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { minHeight: 48, justifyContent: 'center', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1 },
  item: { flex: 1, maxWidth: '50%', minHeight: 196, padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12, gap: 6 },
  itemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  itemPlus: { position: 'absolute', right: 14, top: 20 }, cartBar: { padding: 16, gap: 10, borderTopWidth: 1 },
  gap: { gap: 12 }, line: { gap: 10, paddingBottom: 18, borderBottomWidth: 1 }, quantity: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  quantityValue: { minWidth: 20, textAlign: 'center', fontWeight: '700' }, success: { gap: 16, padding: 24, borderRadius: 20 },
});
