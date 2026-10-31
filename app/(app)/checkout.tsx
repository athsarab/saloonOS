import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard, Landmark, Minus, Plus, ReceiptText, ShoppingBag, Trash2, UserRound, WalletCards } from 'lucide-react-native';
import { Button, Card, EmptyState, Field, Screen } from '../../src/components/ui';
import { PosSheet } from '../../src/components/PosSheet';
import { AppDialog } from '../../src/components/AppDialog';
import { AppErrorState, AppLoadingState } from '../../src/components/AppStates';
import { AppSearchBar } from '../../src/components/AppSearchBar';
import { AppStatusBadge } from '../../src/components/AppStatusBadge';
import { ApiError } from '../../src/lib/api';
import { CatalogItem, CheckoutRequest, Quote, Sale, requestKey, useBranches, useCatalog, useCheckout, useCheckoutAccess, useCloseShift, useCurrentShift, useCustomers, useOpenShift, useQuote, useStaff } from '../../src/lib/checkout-api';
import { cents, decimal, lkr } from '../../src/lib/money';
import { shareReceipt } from '../../src/lib/receipt';
import { feedback, feedbackError } from '../../src/lib/feedback';
import { useTheme } from '../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import { useOffline } from '../../src/offline/runtime';
import { layout, radius, spacing, type } from '../../src/theme/tokens';

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
  const [removeLine, setRemoveLine] = useState<CartLine | null>(null);
  const [count, setCount] = useState(''), [shiftError, setShiftError] = useState('');
  const pay = useCheckout(), price = useQuote(), openShift = useOpenShift(), closeShift = useCloseShift();
  const inFlight = useRef(false);
  const canDiscount = access.data?.permissions.includes('discounts') ?? false;
  const locked = !!attempt || pay.isPending;
  const categories = useMemo(() => ['All', 'Services', 'Products', ...new Set((catalog.data ?? []).map(item => item.category).filter((value): value is string => !!value))], [catalog.data]);
  const items = useMemo(() => (catalog.data ?? []).filter(item =>
    (category === 'All' || (category === 'Services' && item.type === 'SERVICE') || (category === 'Products' && item.type === 'PRODUCT') || item.category === category) &&
    (item.name + ' ' + (item.category ?? '')).toLowerCase().includes(search.toLowerCase())), [catalog.data, search, category]);
  const selectedCustomer = customers.data?.find(customer => customer.id === customerId);
  const estimated = useMemo(() => {
    try { return decimal(cart.reduce((sum, line) => sum + cents(line.item.priceLkr) * BigInt(line.quantity), 0n) - cents(discount || '0')); }
    catch { return null; }
  }, [cart, discount]);

  const edit = (action: () => void) => { if (!locked) { action(); setQuote(null); setMessage(''); } };
  const add = (item: CatalogItem) => edit(() => {
    if (item.trackInventory && Number(item.stockQuantity) <= 0) return;
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
  const billText = () => [
    'SALONOS - BILL',
    '',
    ...cart.map(line => `${line.item.name} x ${line.quantity}  ${lkr(decimal(cents(line.item.priceLkr) * BigInt(line.quantity)))}`),
    '',
    `Total: ${quote ? lkr(quote.totalLkr) : estimated ? lkr(estimated) : '—'}`,
    customerId ? 'Customer: Selected customer' : 'Customer: Walk-in customer',
    '',
    'Payment not recorded.',
  ].join('\n');
  const review = async () => {
    setMessage('');
    if (!offline.apiOnline) { setMessage(feedback.payment.offline); return; }
    try {
      if (!cart.length || !branchId) throw new Error('Choose a branch and at least one item.');
      if (cart.some(line => line.item.type === 'SERVICE' && !line.staffId)) throw new Error('Assign a staff member to every service.');
      if (method === 'BANK_TRANSFER' && !reference.trim()) throw new Error('Enter the bank transfer reference.');
      const next = await price.mutateAsync(payload());
      if (method === 'CASH' && (!cash || cents(cash) < cents(next.totalLkr))) throw new Error('Enter enough cash received to cover ' + lkr(next.totalLkr) + '.');
      setQuote(next);
    } catch (error) { setMessage(feedbackError(error, { fallback: feedback.payment.quoteFailed })); }
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
        setMessage(feedbackError(error, { fallback: 'We could not record the payment. Check the details and try again.' }));
      } else {
        setMessage(feedback.payment.confirmationPending);
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
        setMessage(feedback.payment.shiftOpened);
      } else {
        const closed = await closeShift.mutateAsync({ shiftId: shift.data!.id, closingAmountLkr: amount });
        setMessage(feedback.payment.shiftClosed(lkr(closed.differenceLkr ?? '0.00')));
      }
      setShiftMode(null); setCount('');
    } catch (error) { setShiftError(feedbackError(error, { fallback: 'We could not save the cash shift. Check the amount and try again.' })); }
  };
  const chip = (label: string, selected: boolean, action: () => void, disabled = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={action}
      style={[styles.chip, { backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted, borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.55 : 1 }]}>
      <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  if (access.isPending) return <Screen><View style={styles.center}><AppLoadingState label="Loading checkout…" /></View></Screen>;
  if (access.isError) return <Screen><View style={styles.center}><EmptyState title="Online checkout unavailable" description="Check your connection and make sure your role permits checkout." /><Button label="Authorized offline cash checkout" onPress={() => router.push('/(app)/offline-checkout')} /><Button label="Sync Status" variant="secondary" onPress={() => router.push('/(app)/sync')} /><Button label="Try online again" onPress={() => void access.refetch()} /></View></Screen>;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <FlatList
          data={items} keyExtractor={item => item.id}
          contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
          refreshing={catalog.isFetching} onRefresh={() => { void catalog.refetch(); void shift.refetch(); }}
          ListHeaderComponent={<View style={styles.header}>
            <View style={styles.heading}>
              <View style={styles.flex}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>POS</Text><Text style={{ color: colors.textMuted }}>Build a sale and confirm the payment.</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open cart, ${cart.reduce((sum, line) => sum + line.quantity, 0)} items`} onPress={() => setCartOpen(true)} style={styles.cartAccess}>
                <ShoppingBag color={colors.primary} size={20} />
                <Text style={[type.micro, { color: colors.primary }]}>{cart.reduce((sum, line) => sum + line.quantity, 0)}</Text>
              </Pressable>
            </View>
            <Button label="Offline cash and Sync Status" variant="secondary" onPress={() => router.push('/(app)/sync')} />
            <View style={styles.wrap}>{(branches.data ?? []).map(item => chip(item.name, branchId === item.id, () => { setBranch(item.id); setQuote(null); }, cart.length > 0 && branchId !== item.id))}</View>
            {branches.isError ? <AppErrorState compact title="Couldn’t load branches" message="Checkout needs a branch. Try again." onRetry={() => void branches.refetch()} retrying={branches.isFetching} /> : !branches.isPending && !branches.data?.length ? <Text style={{ color: colors.danger }}>Create a branch in Business settings before checkout.</Text> : null}
            <Card>
              {shift.isError ? <Button label="Retry cash shift" variant="secondary" onPress={() => void shift.refetch()} /> : shift.isPending ? <Text style={{ color: colors.textMuted }}>Checking cash shift...</Text> : <>
                <Text style={[styles.subtitle, { color: colors.text }]}>{shift.data ? 'Cash drawer is open' : 'Start your cash shift'}</Text>
                <Text style={{ color: colors.textMuted }}>{shift.data ? 'Expected cash ' + lkr(shift.data.expectedClosingLkr) : 'Count your opening float before taking cash.'}</Text>
                <Button label={shift.data ? 'Count and close shift' : 'Open cash shift'} variant="secondary" disabled={!branchId || locked} onPress={() => { setCount(''); setShiftError(''); setShiftMode(shift.data ? 'close' : 'open'); }} />
              </>}
            </Card>
            <AppSearchBar accessibilityLabel="Search services and products" placeholder="Search services or products" value={search} onChangeText={setSearch} />
            <View style={styles.wrap}>{categories.map(value => chip(value, category === value, () => setCategory(value)))}</View>
            {catalog.isError ? <AppErrorState compact title="Couldn’t load the catalog" message="Checkout needs an online catalog. Try again." onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} /> : null}
            {!cartOpen && message ? <Text style={{ color: colors.text }}>{message}</Text> : null}
          </View>}
          ListEmptyComponent={catalog.isPending ? <AppLoadingState compact label="Loading catalog…" /> : !catalog.isError ? <EmptyState title="No matching items" description="Try another search or category." /> : undefined}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={'Add ' + item.name + ', ' + lkr(item.priceLkr)} disabled={locked || (item.trackInventory && Number(item.stockQuantity) <= 0)} onPress={() => add(item)}
              style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.trackInventory && Number(item.stockQuantity) <= 0 ? 0.62 : 1 }]}>
              <View style={[styles.itemIcon, { backgroundColor: colors.primarySoft }]}><Text style={[type.bodyStrong, { color: colors.primary }]}>{item.type === 'SERVICE' ? 'S' : 'P'}</Text></View>
              <View style={styles.itemContent}>
                <View style={styles.itemTitleRow}>
                  <Text numberOfLines={1} style={[styles.subtitle, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.price, { color: colors.text }]}>{lkr(item.priceLkr)}</Text>
                </View>
                <View style={styles.itemMeta}>
                  <AppStatusBadge label={item.type === 'SERVICE' ? 'Service' : 'Product'} tone={item.type === 'SERVICE' ? 'accent' : 'neutral'} />
                  <Text numberOfLines={1} style={{ color: colors.textMuted }}>{item.category || (item.type === 'SERVICE' ? 'Service' : 'Product')}</Text>
                  {item.trackInventory ? <Text style={{ color: Number(item.stockQuantity) <= 0 ? colors.danger : colors.textMuted }}>{Number(item.stockQuantity) <= 0 ? 'Unavailable' : `${item.stockQuantity} in stock`}</Text> : null}
                </View>
              </View>
              <View style={[styles.addIcon, { backgroundColor: item.trackInventory && Number(item.stockQuantity) <= 0 ? colors.surfaceMuted : colors.primary }]}>
                <Plus size={18} color={item.trackInventory && Number(item.stockQuantity) <= 0 ? colors.textSubtle : colors.onPrimary} />
              </View>
            </Pressable>
          )}
        />
        <View style={[styles.cartBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cartSummary}><Text style={[type.label, { color: colors.textMuted }]}>{cart.reduce((sum, line) => sum + line.quantity, 0)} {cart.length === 1 ? 'item' : 'items'}</Text><Text style={[type.heading, { color: colors.text }]}>{estimated ? lkr(estimated) : '—'}</Text></View>
          <Button label={attempt ? 'Resolve payment' : 'Review cart'} disabled={!cart.length} onPress={() => { setCompleted(null); setCartOpen(true); }} />
        </View>
      </SafeAreaView>

      <PosSheet visible={cartOpen} title={completed ? (completed.status === 'OPEN' ? 'Transfer recorded' : 'Payment received') : quote ? 'Confirm payment' : 'Your cart'} onClose={() => setCartOpen(false)} locked={pay.isPending}>
        {completed ? <>
          <View style={[styles.success, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.title, { color: colors.primary }]}>{lkr(completed.totalLkr)}</Text>
            <Text selectable style={{ color: colors.text }}>{completed.receiptNumber}</Text>
            <Text style={{ color: colors.textMuted }}>{completed.status === 'OPEN' ? 'Pending bank verification. This is not a confirmed payment.' : 'Cash received. Change: ' + lkr(completed.changeLkr ?? '0.00')}</Text>
          </View>
          <Button label="Share receipt" onPress={() => void shareReceipt(completed.receiptText).then(setMessage).catch(() => setMessage(feedback.payment.shareFailed))} />
          <Button label="Next customer" variant="secondary" onPress={() => { setCompleted(null); setCartOpen(false); setMessage(''); }} />
        </> : <>
          {cart.map(line => <View key={line.item.id} style={[styles.line, { borderColor: colors.border }]}>
            <View style={styles.lineHeader}><View style={styles.lineCopy}><Text style={[styles.subtitle, { color: colors.text }]}>{line.item.name}</Text><Text style={{ color: colors.textMuted }}>{lkr(line.item.priceLkr)} each</Text></View><View style={[styles.quantityControls, { backgroundColor: colors.primarySoft }]}>
              <Pressable style={styles.quantity} accessibilityRole="button" accessibilityLabel={'Remove one ' + line.item.name} disabled={locked} onPress={() => edit(() => setCart(current => current.map(value => value.item.id === line.item.id ? { ...value, quantity: value.quantity - 1 } : value).filter(value => value.quantity > 0)))}><Minus color={colors.primary} size={20} /></Pressable>
              <Text style={[styles.quantityValue, { color: colors.text }]}>{line.quantity}</Text>
              <Pressable style={styles.quantity} accessibilityRole="button" accessibilityLabel={'Add one ' + line.item.name} disabled={locked} onPress={() => add(line.item)}><Plus color={colors.primary} size={20} /></Pressable>
            </View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line.item.name} from cart`} disabled={locked} onPress={() => setRemoveLine(line)} style={styles.iconButton}><Trash2 color={colors.danger} size={18} /></Pressable></View>
            {line.item.type === 'SERVICE' ? <><Text style={{ color: colors.textMuted }}>Staff member</Text><View style={styles.wrap}>{(staff.data ?? []).map(member => chip(member.user.displayName, line.staffId === member.id, () => edit(() => setCart(current => current.map(value => value.item.id === line.item.id ? { ...value, staffId: member.id } : value))), locked))}</View>{!staff.data?.length ? <Text style={{ color: colors.danger }}>Add an active staff profile for this branch before selling a service.</Text> : null}</> : null}
          </View>)}
          {staff.isError ? <Button label="Retry staff list" onPress={() => void staff.refetch()} /> : null}
          {!quote && !attempt ? <>
            <View style={styles.sectionTitle}><View><Text style={[type.heading, { color: colors.text }]}>Customer</Text>{selectedCustomer ? <Text style={[type.caption, { color: colors.textMuted }]}>{selectedCustomer.firstName} {selectedCustomer.lastName ?? ''}</Text> : null}</View>{customerId ? <AppStatusBadge label="Selected" tone="accent" /> : null}</View>
            <View style={styles.customerSelected}>{chip('Walk-in customer', !customerId, () => edit(() => setCustomerId(undefined)))}</View>
            <AppSearchBar accessibilityLabel="Search customers by name or phone" placeholder="Search customers by name or phone" value={customerSearch} onChangeText={setCustomerSearch} />
            <View style={styles.customerResults}>{(customers.data ?? []).slice(0, 6).map(customer => <Pressable key={customer.id} accessibilityRole="button" accessibilityState={{ selected: customerId === customer.id }} onPress={() => edit(() => setCustomerId(customer.id))} style={[styles.customerRow, { borderColor: customerId === customer.id ? colors.primary : colors.border, backgroundColor: customerId === customer.id ? colors.primarySoft : colors.surface }]}><UserRound color={colors.primary} size={18} /><View style={styles.flex}><Text style={[type.bodyStrong, { color: colors.text }]}>{customer.firstName} {customer.lastName ?? ''}</Text><Text style={[type.caption, { color: colors.textMuted }]}>{customer.phone ?? 'No phone number'}</Text></View></Pressable>)}</View>
            {customers.isError ? <Button label="Retry customer search" onPress={() => void customers.refetch()} /> : null}
            <View style={styles.sectionTitle}><Text style={[type.heading, { color: colors.text }]}>Discount</Text>{canDiscount ? <Text style={[type.caption, { color: colors.textMuted }]}>Manager permission</Text> : null}</View>
            {canDiscount ? <Field label="Discount (LKR)" value={discount} onChangeText={value => edit(() => setDiscount(value))} keyboardType="decimal-pad" /> : <Text style={{ color: colors.textMuted }}>Discounts require an owner or manager.</Text>}
            <View style={styles.sectionHeading}><CreditCard color={colors.primary} size={22} /><Text style={[type.heading, { color: colors.text }]}>Payment method</Text></View>
            <View style={styles.paymentMethods}><PaymentChip colors={colors} label="Cash" Icon={WalletCards} selected={method === 'CASH'} onPress={() => edit(() => setMethod('CASH'))} /><PaymentChip colors={colors} label="Bank transfer" Icon={Landmark} selected={method === 'BANK_TRANSFER'} onPress={() => edit(() => setMethod('BANK_TRANSFER'))} /></View>
            {method === 'CASH' ? <Field label="Cash received (LKR)" value={cash} onChangeText={value => edit(() => setCash(value))} keyboardType="decimal-pad" placeholder="Enter amount received" /> : <><Field label="Bank transfer reference" value={reference} onChangeText={value => edit(() => setReference(value))} maxLength={120} /><AppStatusBadge label="Pending manager verification" tone="warning" /></>}
            <View style={[styles.totalPreview, { backgroundColor: colors.primarySoft }]}><View style={styles.totalIcon}><ReceiptText color={colors.primary} size={44} /></View><View style={styles.totalCopy}><Text style={[type.heading, { color: colors.textMuted }]}>Estimated total</Text><Text style={[styles.totalValue, { color: colors.text }]}>{estimated ? lkr(estimated) : '—'}</Text><Text style={[type.caption, { color: colors.textMuted }]}>Final subtotal, discount, and total are confirmed by saloonOS when you review payment.</Text></View></View>
            <Button label="Refresh cart prices" variant="secondary" onPress={() => void catalog.refetch().then(result => {
              if (!result.data) { setMessage(feedback.payment.quoteFailed); return; }
              const latest = new Map(result.data.map(item => [item.id, item]));
              edit(() => setCart(current => current.map(line => ({ ...line, item: latest.get(line.item.id) ?? line.item }))));
              setMessage(feedback.payment.pricesRefreshed);
            })} />
            <Button label="Review payment" disabled={!cart.length || price.isPending} loading={price.isPending} onPress={() => void review()} />
          </> : <>
            <Card>
              <Text style={{ color: colors.textMuted }}>Quote confirmed by SalonOS</Text>
              <View style={styles.totalRows}><Text style={{ color: colors.textMuted }}>Subtotal</Text><Text style={{ color: colors.text }}>{lkr(quote?.subtotalLkr ?? '0.00')}</Text><Text style={{ color: colors.textMuted }}>Discount</Text><Text style={{ color: colors.text }}>{lkr(quote?.discountLkr ?? '0.00')}</Text><Text style={[type.heading, { color: colors.text }]}>Total</Text><Text style={[styles.title, { color: colors.primary }]}>{lkr(quote?.totalLkr ?? attempt!.payload.expectedTotalLkr!)}</Text></View>
              <Text style={{ color: colors.text }}>{method === 'CASH' ? 'Cash / received ' + lkr(cash) : 'Bank transfer / ' + reference}</Text>
              {method === 'CASH' && quote ? <Text style={{ color: colors.primary }}>Change {lkr(decimal(cents(cash) - cents(quote.totalLkr)))}</Text> : <AppStatusBadge label="Transfer not verified — payment is not confirmed" tone="warning" />}
              {method === 'CASH' && !shift.data ? <Text style={{ color: colors.danger }}>Open a cash shift before confirming payment. You can print this bill now.</Text> : null}
            </Card>
            {!attempt ? <Button label="Print / share bill" variant="secondary" onPress={() => void shareReceipt(billText()).then(setMessage).catch(() => setMessage(feedback.payment.shareFailed))} /> : null}
            {method === 'CASH' && !shift.data && !attempt ? <Button label="Open cash shift to take payment" onPress={() => { setCount(''); setShiftError(''); setShiftMode('open'); }} /> : <Button label={attempt ? 'Retry safely' : method === 'CASH' ? 'Confirm cash received' : 'Record pending transfer'} onPress={() => void confirm()} loading={pay.isPending} />}
            {!attempt ? <Button label="Edit cart" variant="secondary" onPress={() => setQuote(null)} /> : null}
          </>}
        </>}
        {message ? <Text style={{ color: colors.text }}>{message}</Text> : null}
      </PosSheet>

      <AppDialog visible={!!removeLine} title="Remove this item?" message={removeLine ? `${removeLine.item.name} will be removed from the cart. You can add it again before payment.` : undefined} confirmLabel="Remove item" tone="danger" onCancel={() => setRemoveLine(null)} onConfirm={() => { if (removeLine) edit(() => setCart(current => current.filter(line => line.item.id !== removeLine.item.id))); setRemoveLine(null); }} />

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

function PaymentChip({ colors, label, Icon, selected, onPress }: { colors: ReturnType<typeof useTheme>['colors']; label: string; Icon: typeof WalletCards; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.paymentChip, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border }]}><View style={[styles.paymentIcon, { backgroundColor: colors.primarySoft }]}><Icon color={colors.primary} size={22} /></View><Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text><View style={[styles.radio, { borderColor: selected ? colors.primary : colors.borderStrong, backgroundColor: selected ? colors.primary : 'transparent' }]}>{selected ? <View style={styles.radioDot} /> : null}</View></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, center: { flex: 1, padding: spacing.xxl, justifyContent: 'center', gap: spacing.lg },
  list: { padding: spacing.lg, paddingBottom: layout.screenBottomInset }, header: { gap: spacing.lg, marginBottom: spacing.xl },
  eyebrow: { ...type.micro }, title: { ...type.title },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  subtitle: { ...type.heading }, price: { ...type.bodyStrong, marginVertical: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  chip: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1 },
  item: { alignItems: 'center', flexDirection: 'row', minHeight: 76, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, gap: spacing.md },
  itemIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  itemContent: { flex: 1, gap: spacing.xs }, itemTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, itemMeta: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  addIcon: { alignItems: 'center', borderRadius: radius.sm, height: 36, justifyContent: 'center', width: 36 }, cartAccess: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 44, minWidth: 44, justifyContent: 'center' }, cartBar: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1 },
  gap: { gap: spacing.md }, line: { gap: spacing.sm, paddingBottom: spacing.xl, borderBottomWidth: 1 }, quantity: { minWidth: 32, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  quantityValue: { minWidth: 20, ...type.bodyStrong }, success: { gap: spacing.lg, padding: spacing.xxl, borderRadius: radius.xl },
  cartSummary: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  lineHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, lineCopy: { flex: 1, gap: spacing.xs }, quantityControls: { alignItems: 'center', borderRadius: radius.pill, flexDirection: 'row' },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  sectionTitle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  customerSelected: { alignItems: 'flex-start' },
  customerResults: { gap: spacing.sm },
  customerRow: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 56, padding: spacing.md },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, paymentMethods: { flexDirection: 'row', gap: spacing.sm }, paymentChip: { alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 76, padding: spacing.sm }, paymentIcon: { alignItems: 'center', borderRadius: radius.pill, height: 42, justifyContent: 'center', width: 42 }, radio: { alignItems: 'center', borderRadius: radius.pill, borderWidth: 2, height: 22, justifyContent: 'center', marginLeft: 'auto', width: 22 }, radioDot: { backgroundColor: '#FFFFFF', borderRadius: radius.pill, height: 8, width: 8 }, totalPreview: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: spacing.lg, padding: spacing.xl }, totalIcon: { alignItems: 'center', justifyContent: 'center' }, totalCopy: { flex: 1, gap: spacing.xs }, totalValue: { fontSize: 30, fontWeight: '700' },
  totalRows: { alignItems: 'center', columnGap: spacing.md, flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xs },
});
