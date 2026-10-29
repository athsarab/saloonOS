import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppHeader } from '../../src/components/AppHeader';
import { AppListIcon, AppListItem } from '../../src/components/AppListItem';
import { AppSectionHeader } from '../../src/components/AppSectionHeader';
import { AppEmptyState, AppErrorState, AppInlineError, AppLoadingState } from '../../src/components/AppStates';
import { AppStatusBadge } from '../../src/components/AppStatusBadge';
import { AppTextField } from '../../src/components/AppTextField';
import { Screen } from '../../src/components/ui';
import { NewCatalogItem, useCreateCatalogItem } from '../../src/lib/checkout-api';
import { friendlyError } from '../../src/lib/errors';
import { roleLabel, usePermissions } from '../../src/lib/permissions';
import { BusinessProfile, NewBranch, NewSalonService, NewStaffMember, useBusinessProfile, useCreateBranch, useCreateSalonService, useCreateStaffMember, useSalonStaff } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, spacing, type as typeStyles } from '../../src/theme/tokens';

export default function BusinessSettingsScreen() {
  const { colors } = useTheme();
  const { role, can } = usePermissions();
  const profile = useBusinessProfile();
  const create = useCreateBranch();
  const createItem = useCreateCatalogItem();
  const createService = useCreateSalonService();
  const createStaff = useCreateStaffMember();
  const staff = useSalonStaff();
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [catalogType, setCatalogType] = useState<'SERVICE' | 'PRODUCT'>('SERVICE');
  const business = profile.data;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <AppHeader back title="Business settings" description="Details your team and receipts use." />
          {profile.isPending ? <AppLoadingState label="Loading business details…" /> : profile.isError ? (
            <AppErrorState title="Couldn’t load business details" message={friendlyError(profile.error, { fallback: 'Please try again.' })} onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
          ) : business ? (
            <>
              <AppCard>
                <View style={styles.row}>
                  <Text style={[typeStyles.caption, { color: colors.textMuted }]}>Business name</Text>
                  {role ? <AppStatusBadge label={`You: ${roleLabel[role]}`} tone="accent" /> : null}
                </View>
                <Text style={[typeStyles.heading, { color: colors.text }]}>{business.name}</Text>
                <Text style={[typeStyles.caption, { color: colors.textMuted }]}>Workspace ID: {business.slug}</Text>
              </AppCard>
              <View style={styles.group}>
                <View style={styles.sectionHeader}>
                  <AppSectionHeader title={`Branches (${business.branches.length})`} />
                  {can('business.settings.write') ? <AppButton label="Add branch" size="sm" fullWidth={false} onPress={() => setBranchFormOpen(true)} /> : null}
                </View>
                <AppCard padded={false}>
                  {business.branches.length ? business.branches.map((branch, index) => (
                    <AppListItem
                      key={branch.id}
                      divider={index > 0}
                      title={branch.name}
                      subtitle={[branch.code, branch.address, branch.timezone].filter(Boolean).join(' · ')}
                      leading={<AppListIcon><MapPin color={colors.primary} size={iconSize.md} /></AppListIcon>}
                    />
                  )) : <AppEmptyState compact title="No branches yet" description="A branch is needed before you can take payments." />}
                </AppCard>
              </View>
              {!can('business.settings.write') ? <Text style={[typeStyles.caption, { color: colors.textMuted }]}>Only an owner or manager can add branches.</Text> : null}
              {can('inventory.write') || can('services.write') ? (
                <View style={styles.group}>
                  <AppSectionHeader title="Catalog" />
                  <AppCard>
                    <Text style={[typeStyles.body, { color: colors.textMuted }]}>Add services and products here so they appear in POS.</Text>
                    <View style={styles.actions}>
                      {can('services.write') ? <AppButton label="Add service" fullWidth={false} onPress={() => { setCatalogType('SERVICE'); setCatalogFormOpen(true); }} /> : null}
                      {can('inventory.write') ? <AppButton label="Add product" variant="secondary" fullWidth={false} onPress={() => { setCatalogType('PRODUCT'); setCatalogFormOpen(true); }} /> : null}
                    </View>
                  </AppCard>
                </View>
              ) : null}
              {can('staff.write') ? (
                <View style={styles.group}>
                  <View style={styles.sectionHeader}>
                    <AppSectionHeader title={`Staff (${staff.data?.length ?? 0})`} />
                    <AppButton label="Add staff" size="sm" fullWidth={false} onPress={() => setStaffFormOpen(true)} />
                  </View>
                  <AppCard padded={false}>
                    {staff.data?.length ? staff.data.map((member, index) => (
                      <AppListItem key={member.id} divider={index > 0} title={member.user.displayName} subtitle={[member.title, member.user.email].filter(Boolean).join(' · ')} leading={<AppListIcon><MapPin color={colors.primary} size={iconSize.md} /></AppListIcon>} />
                    )) : <AppEmptyState compact title="No staff profiles yet" description="Add an active staff member for service appointments and POS." />}
                  </AppCard>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <AddBranchSheet visible={branchFormOpen} onClose={() => setBranchFormOpen(false)} create={create} />
      <CatalogSheet visible={catalogFormOpen} type={catalogType} onClose={() => setCatalogFormOpen(false)} createItem={createItem} createService={createService} />
      <StaffSheet visible={staffFormOpen} branches={business?.branches ?? []} onClose={() => setStaffFormOpen(false)} create={createStaff} />
    </Screen>
  );
}

function StaffSheet({ visible, branches, onClose, create }: { visible: boolean; branches: BusinessProfile['branches']; onClose: () => void; create: ReturnType<typeof useCreateStaffMember> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [branchId, setBranchId] = useState('');
  const [role, setRole] = useState<NewStaffMember['role']>('STYLIST');
  const [error, setError] = useState('');
  const { colors } = useTheme();
  const submit = async () => {
    if (name.trim().length < 2 || !email.trim() || password.length < 8 || !branchId) {
      setError('Enter a name, email, password with at least 8 characters, and choose a branch.');
      return;
    }
    setError('');
    try {
      await create.mutateAsync({ displayName: name.trim(), email: email.trim().toLowerCase(), password, branchId, role, ...(title.trim() ? { title: title.trim() } : {}) });
      setName('');
      setEmail('');
      setPassword('');
      setTitle('');
      setBranchId('');
      setRole('STYLIST');
      onClose();
    } catch (reason) {
      setError(friendlyError(reason, { fallback: 'The staff member could not be created. Please try again.' }));
    }
  };
  return (
    <AppBottomSheet visible={visible} title="Add staff member" onClose={onClose} locked={create.isPending}>
      <AppTextField label="Full name" placeholder="e.g. Amaya Jayasinghe" value={name} onChangeText={setName} autoCapitalize="words" maxLength={120} />
      <AppTextField label="Email" placeholder="staff@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={320} />
      <AppTextField label="Temporary password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry maxLength={128} />
      <AppTextField label="Job title (optional)" placeholder="e.g. Senior stylist" value={title} onChangeText={setTitle} maxLength={120} />
      <Text style={[typeStyles.label, { color: colors.text }]}>Branch</Text>
      <View style={styles.actions}>{branches.map((branch) => <AppButton key={branch.id} label={branch.name} size="sm" fullWidth={false} variant={branchId === branch.id ? 'primary' : 'secondary'} onPress={() => setBranchId(branch.id)} />)}</View>
      <Text style={[typeStyles.label, { color: colors.text }]}>Role</Text>
      <View style={styles.actions}>
        <AppButton label="Stylist" size="sm" fullWidth={false} variant={role === 'STYLIST' ? 'primary' : 'secondary'} onPress={() => setRole('STYLIST')} />
        <AppButton label="Cashier" size="sm" fullWidth={false} variant={role === 'CASHIER' ? 'primary' : 'secondary'} onPress={() => setRole('CASHIER')} />
      </View>
      <AppInlineError message={error} />
      <AppButton label="Create staff member" loading={create.isPending} onPress={() => void submit()} />
    </AppBottomSheet>
  );
}

function CatalogSheet({ visible, type, onClose, createItem, createService }: { visible: boolean; type: 'SERVICE' | 'PRODUCT'; onClose: () => void; createItem: ReturnType<typeof useCreateCatalogItem>; createService: ReturnType<typeof useCreateSalonService> }) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [stock, setStock] = useState('0');
  const [trackInventory, setTrackInventory] = useState(false);
  const [error, setError] = useState('');
  const pending = createItem.isPending || createService.isPending;
  const submit = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || !price.trim() || Number(price) <= 0) {
      setError('Enter a name and a valid positive price.');
      return;
    }
    setError('');
    try {
      if (type === 'SERVICE') {
        const minutes = Number(duration);
        if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
          setError('Service duration must be between 5 and 1440 minutes.');
          return;
        }
        const payload: NewSalonService = { name: trimmedName, priceLkr: Number(price), durationMinutes: minutes };
        if (category.trim()) payload.category = category.trim();
        await createService.mutateAsync(payload);
      } else {
        if (trackInventory && !/^\d{1,7}$/.test(stock.trim())) {
          setError('Stock must be a whole number from 0 to 9999999.');
          return;
        }
        const payload: NewCatalogItem = { name: trimmedName, type, priceLkr: price.trim(), stockQuantity: trackInventory ? stock.trim() : '0', trackInventory };
        if (category.trim()) payload.category = category.trim();
        await createItem.mutateAsync(payload);
      }
      setName('');
      setCategory('');
      setPrice('');
      setDuration('30');
      setStock('0');
      setTrackInventory(false);
      onClose();
    } catch (reason) {
      setError(friendlyError(reason, { fallback: `The ${type === 'SERVICE' ? 'service' : 'product'} could not be created. Please try again.` }));
    }
  };
  return (
    <AppBottomSheet visible={visible} title={`Add ${type === 'SERVICE' ? 'service' : 'product'}`} onClose={onClose} locked={pending}>
      <AppTextField label="Name" placeholder={type === 'SERVICE' ? 'e.g. Haircut' : 'e.g. Shampoo'} value={name} onChangeText={setName} maxLength={160} />
      <AppTextField label="Category (optional)" placeholder="e.g. Hair care" value={category} onChangeText={setCategory} maxLength={80} />
      <AppTextField label="Price (LKR)" placeholder="2500.00" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      {type === 'SERVICE' ? <AppTextField label="Duration (minutes)" placeholder="30" value={duration} onChangeText={setDuration} keyboardType="number-pad" /> : <>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={[typeStyles.label, { color: colors.text }]}>Track inventory</Text>
            <Text style={[typeStyles.caption, { color: colors.textMuted }]}>Turn this on only when stock is set up for every selling branch.</Text>
          </View>
          <Switch value={trackInventory} onValueChange={setTrackInventory} trackColor={{ false: colors.borderStrong, true: colors.primarySoft }} thumbColor={trackInventory ? colors.primary : colors.textMuted} />
        </View>
        {trackInventory ? <AppTextField label="Opening stock" placeholder="0" value={stock} onChangeText={setStock} keyboardType="number-pad" /> : null}
      </>}
      <AppInlineError message={error} />
      <AppButton label={`Create ${type === 'SERVICE' ? 'service' : 'product'}`} loading={pending} onPress={() => void submit()} />
    </AppBottomSheet>
  );
}

function AddBranchSheet({ visible, onClose, create }: { visible: boolean; onClose: () => void; create: ReturnType<typeof useCreateBranch> }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('Asia/Colombo');
  const [error, setError] = useState('');
  const submit = async () => {
    const payload: NewBranch = { name: name.trim(), code: code.trim().toUpperCase(), timezone: timezone.trim() || undefined };
    if (address.trim()) payload.address = address.trim();
    if (payload.name.length < 2 || payload.code.length < 2) {
      setError('Enter a branch name and a code with at least 2 characters.');
      return;
    }
    setError('');
    try {
      await create.mutateAsync(payload);
      setName('');
      setCode('');
      setAddress('');
      setTimezone('Asia/Colombo');
      onClose();
    } catch (reason) {
      setError(friendlyError(reason, { fallback: 'The branch could not be created. Please try again.' }));
    }
  };
  return (
    <AppBottomSheet visible={visible} title="Add branch" onClose={onClose} locked={create.isPending}>
      <AppTextField label="Branch name" placeholder="e.g. Colombo City" value={name} onChangeText={setName} autoCapitalize="words" maxLength={100} />
      <AppTextField label="Branch code" placeholder="e.g. CMB" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={20} />
      <AppTextField label="Address (optional)" placeholder="Street or area" value={address} onChangeText={setAddress} maxLength={255} />
      <AppTextField label="Timezone" placeholder="Asia/Colombo" value={timezone} onChangeText={setTimezone} autoCapitalize="none" />
      <AppInlineError message={error} />
      <AppButton label="Create branch" loading={create.isPending} onPress={() => void submit()} />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  group: { gap: spacing.sm },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  switchCopy: { flex: 1, gap: spacing.xs },
});
