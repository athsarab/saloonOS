import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text as NativeText, type TextProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Screen } from '../../src/components/ui';
import { AppHeader } from '../../src/components/AppHeader';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useBranches, useCheckoutAccess } from '../../src/lib/checkout-api';
import { apiRequest } from '../../src/lib/api';
import { shareReceipt } from '../../src/lib/receipt';
import { lkr } from '../../src/lib/money';
import { feedback, feedbackError } from '../../src/lib/feedback';
import { offlineSupported, prepareOffline, probeApi, registerOfflineDevice, retryOffline, useOffline } from '../../src/offline/runtime';
import { layout, radius, spacing, type } from '../../src/theme/tokens';

function Text({ style, ...props }: TextProps) { const { colors } = useTheme(); return <NativeText {...props} style={[{ color: colors.text }, style]} />; }

export default function SyncScreen() {
  const { snapshot, items, apiOnline, checking, syncing, error, locked } = useOffline();
  const branches = useBranches(), access = useCheckoutAccess();
  const [branch, setBranch] = useState('');
  const branchId = branch || snapshot?.branch.id || branches.data?.[0]?.id;
  const [name, setName] = useState('SalonOS Android till'), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const manager = access.data?.permissions.includes('business.settings.write');
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage('');
    try { await action(); setMessage(success); } catch (error) { setMessage(feedbackError(error, { fallback: feedback.offline.syncFailed })); }
    finally { setBusy(false); }
  };
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <AppHeader back title="Offline & sync" />
    {!offlineSupported ? <Text>Offline cash checkout is available on Android only. Web and iOS use online checkout.</Text> : <>
      <Card>
        <Text style={styles.heading}>{checking ? 'Checking connectivity...' : apiOnline ? 'API reachable' : 'Offline / API unreachable'}</Text>
        <Text>Network availability alone does not confirm the API or database is reachable.</Text>
        <Button label="Check connection and synchronize" disabled={busy || syncing} loading={syncing} onPress={() => void run(async () => { await retryOffline(); }, 'Connection checked. Pending retries retain their original operation IDs.')} />
        <Button label="Sign in again" variant="ghost" onPress={() => router.push('/login')} />
      </Card>
      {snapshot ? <Card>
        <Text style={styles.heading}>{snapshot.branch.name}</Text>
        <Text>Catalog refreshed: {new Date(snapshot.downloadedAt).toLocaleString()}</Text>
        <Text>Catalog valid until: {new Date(snapshot.catalogExpiresAt).toLocaleString()}</Text>
        <Text>Offline session ends: {new Date(snapshot.expiresAt).toLocaleString()}</Text>
        <Text>Limits: {snapshot.limits.maxSales} sales, {lkr(snapshot.limits.maxSaleLkr)} per sale, {lkr(snapshot.limits.maxTotalLkr)} per session.</Text>
        <Text>{locked ? 'Offline checkout is locked. Reconnect and resolve authorization or financial issues with a manager.' : 'Cash only, walk-in customers, no discounts or offline refunds.'}</Text>
        <Button label="Open offline cash checkout" onPress={() => router.push('/(app)/offline-checkout')} />
      </Card> : <Text>Register this device and prepare an offline session while online before collecting offline cash.</Text>}
      <Card>
        <Text style={styles.heading}>Prepare this till online</Text>
        {manager ? <>
          <Field label="Device name" value={name} onChangeText={setName} maxLength={80} />
          <Button label="Register device (manager)" disabled={busy || !apiOnline} onPress={() => void run(() => registerOfflineDevice(name), 'Device registered. Open a cash shift online, then download your catalog.')} />
          <Button label="List registered devices" variant="secondary" disabled={busy || !apiOnline} onPress={() => void run(async () => { setDevices(await apiRequest('/v1/offline/devices')); }, 'Device list refreshed.')} />
          {devices.map(device => <View key={device.id} style={styles.gap}><Text>{device.name}: {device.active ? 'active' : 'revoked'}</Text>{device.active ? <Button label={'Revoke ' + device.name} variant="secondary" onPress={() => void run(() => apiRequest('/v1/offline/devices/' + device.id + '/revoke', { method: 'POST' }), 'Device revoked on the server. Unsynchronized cash may require manager review.')} /> : null}</View>)}
        </> : <Text>A manager must first register this device. Cashiers can then prepare their own offline session.</Text>}
        <View style={styles.wrap}>{branches.data?.map(value => <Pressable key={value.id} style={styles.chip} accessibilityRole="button" onPress={() => setBranch(value.id)}><Text>{branchId === value.id ? 'Selected: ' : ''}{value.name}</Text></Pressable>)}</View>
        <Button label="Download catalog and offline authorization" disabled={busy || !apiOnline || !branchId} loading={busy} onPress={() => void run(() => prepareOffline(branchId!), 'Encrypted catalog and offline authorization saved.')} />
        <Text>Open your cash shift in Checkout first. Synchronize all pending cash before refreshing, signing out, closing the shift, or changing users.</Text>
        <Button label="Refresh connection" variant="ghost" onPress={() => void probeApi()} />
      </Card>
      <Text style={styles.heading}>Cash operations ({items.length}, recent confirmations and all unresolved)</Text>
      {!items.length ? <Text>No locally recorded cash sales for this account and business.</Text> : null}
      {items.map(item => <Card key={item.id}>
        <Text style={styles.heading}>{item.state.toUpperCase()}</Text>
        <Text selectable>LOCAL-{item.id}</Text>
        <Text>{new Date(item.operation.recordedAt).toLocaleString()} / {lkr(item.operation.checkout.expectedTotalLkr!)}</Text>
        <Text>        {item.message || feedback.offline.syncPending}</Text>
        {item.result?.receiptNumber ? <Text selectable>Final server receipt: {item.result.receiptNumber}</Text> : <Text>No final invoice number assigned.</Text>}
        {item.state === 'pending' ? <Text>Attempt {item.attempts}. Next automatic attempt: {item.next_retry_at ? new Date(item.next_retry_at).toLocaleTimeString() : 'when the API is reachable'}. Automatic sync runs while the app is open.</Text> : null}
        {['pending', 'blocked'].includes(item.state) ? <Button label="Retry this operation safely" disabled={busy || syncing} onPress={() => void run(() => retryOffline(item.id), 'Retry scheduled without changing the sale.')} /> : null}
        {['conflicted', 'rejected'].includes(item.state) ? <Text>Do not collect cash again or create a replacement sale. A manager must reconcile this cash and its price, stock, shift, or authorization issue. This financial record cannot be silently edited or retried as a new operation.</Text> : null}
        <Button label={item.result?.receiptText ? 'Share server receipt' : 'Share provisional receipt'} variant="secondary" onPress={() => void run(() => shareReceipt(item.result?.receiptText ?? item.operation.provisionalReceipt), 'Receipt opened for sharing.')} />
      </Card>)}
    </>}
    {message ? <Text>{message}</Text> : null}
    {error ? <Text>{error}</Text> : null}
  </ScrollView></SafeAreaView></Screen>;
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: layout.screenBottomInset },
  title: { ...type.title },
  heading: { ...type.heading, marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { padding: spacing.md, minHeight: 48, borderWidth: 1, borderRadius: radius.md },
  gap: { gap: spacing.sm, marginVertical: spacing.sm },
});
