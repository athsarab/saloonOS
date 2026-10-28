import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { UserPlus, Users } from 'lucide-react-native';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { AppButton } from '../../src/components/AppButton';
import { AppHeader } from '../../src/components/AppHeader';
import { AppAvatar, AppListItem } from '../../src/components/AppListItem';
import { AppSearchBar } from '../../src/components/AppSearchBar';
import { AppEmptyState, AppErrorState, AppInlineError, AppLoadingState } from '../../src/components/AppStates';
import { AppTextField } from '../../src/components/AppTextField';
import { useToast } from '../../src/components/AppToast';
import { Screen } from '../../src/components/ui';
import { emailPattern, friendlyError } from '../../src/lib/errors';
import { fullName } from '../../src/lib/format';
import { usePermissions } from '../../src/lib/permissions';
import { NewCustomer, useCreateCustomer, useCustomerList } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, radius, spacing, type } from '../../src/theme/tokens';

type CustomerForm = { firstName: string; lastName: string; phone: string; email: string };
const emptyForm: CustomerForm = { firstName: '', lastName: '', phone: '', email: '' };

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CustomersScreen() {
  const { colors } = useTheme();
  const { can } = usePermissions();
  const params = useLocalSearchParams<{ new?: string }>();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  const customers = useCustomerList(query);
  const canAdd = can('customer.write');
  const [addingManually, setAdding] = useState(false);
  // The dashboard quick action opens the form with /(app)/customers?new=1
  const adding = canAdd && (addingManually || params.new === '1');
  const closeAdd = () => { setAdding(false); if (params.new) router.setParams({ new: undefined }); };

  const items = customers.data?.items ?? [];
  const total = customers.data?.total ?? 0;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <FlatList
          data={customers.isError ? [] : items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={customers.isRefetching} onRefresh={() => void customers.refetch()} colors={[colors.primary]} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppHeader title="Customers" />
              <View style={styles.toolbar}>
                <View style={styles.flex}><AppSearchBar value={search} onChangeText={setSearch} placeholder="Search name or phone" /></View>
                {canAdd ? <AppButton label="Add" size="sm" fullWidth={false} accessibilityLabel="Add customer" icon={<UserPlus color={colors.onPrimary} size={iconSize.sm + 2} />} onPress={() => setAdding(true)} style={styles.add} /> : null}
              </View>
              {customers.data && !customers.isError ? (
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {query ? `${total} ${total === 1 ? 'match' : 'matches'}` : `${total} ${total === 1 ? 'customer' : 'customers'}`}{total > items.length ? ` · showing ${items.length} most recent` : ''}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            customers.isPending ? <AppLoadingState label="Loading customers…" /> : customers.isError ? (
              <AppErrorState title="Couldn’t load customers" message={friendlyError(customers.error, { fallback: 'Please try again.' })} onRetry={() => void customers.refetch()} retrying={customers.isFetching} />
            ) : query ? (
              <AppEmptyState title="No matching customers" description={`Nothing found for “${query}”. Check the spelling or search by phone number.`} />
            ) : (
              <AppEmptyState
                icon={<Users color={colors.textSubtle} size={iconSize.lg} />}
                title="No customers yet"
                description="Add customers to keep their contact details ready for bookings and receipts."
                action={canAdd ? <AppButton label="Add first customer" fullWidth={false} onPress={() => setAdding(true)} /> : undefined}
              />
            )
          }
          renderItem={({ item, index }) => (
            <View style={[styles.rowWrap, { borderColor: colors.border }, index === 0 && styles.first, index === items.length - 1 && styles.last]}>
              <AppListItem
                divider={index > 0}
                title={fullName(item)}
                subtitle={[item.phone, item.email].filter(Boolean).join(' · ') || 'No contact details'}
                leading={<AppAvatar name={fullName(item)} />}
              />
            </View>
          )}
        />
      </SafeAreaView>
      <AddCustomerSheet visible={adding} onClose={closeAdd} />
    </Screen>
  );
}

function AddCustomerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateCustomer();
  const submitting = useRef(false);
  const { control, handleSubmit, reset, setError, formState: { errors } } = useForm<CustomerForm>({ defaultValues: emptyForm, mode: 'onTouched' });

  const submit = async (values: CustomerForm) => {
    if (submitting.current) return;
    submitting.current = true;
    const payload: NewCustomer = { firstName: values.firstName.trim() };
    if (values.lastName.trim()) payload.lastName = values.lastName.trim();
    if (values.phone.trim()) payload.phone = values.phone.trim();
    if (values.email.trim()) payload.email = values.email.trim().toLowerCase();
    try {
      const created = await create.mutateAsync(payload);
      reset(emptyForm);
      onClose();
      toast.show(`${fullName(created)} added`);
    } catch (error) {
      setError('root', { message: friendlyError(error, { fallback: 'The customer could not be saved. Please try again.', byStatus: { 409: 'A customer with this email already exists.' } }) });
    } finally {
      submitting.current = false;
    }
  };

  return (
    <AppBottomSheet visible={visible} title="Add customer" onClose={onClose} locked={create.isPending}>
      <Controller control={control} name="firstName" rules={{ validate: (value) => value.trim().length > 0 || 'Enter the customer’s first name' }} render={({ field }) => (
        <AppTextField label="First name" placeholder="e.g. Nadeesha" autoCapitalize="words" autoComplete="name-given" textContentType="givenName" returnKeyType="next" maxLength={80} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.firstName?.message} />
      )} />
      <Controller control={control} name="lastName" render={({ field }) => (
        <AppTextField label="Last name (optional)" placeholder="e.g. Fernando" autoCapitalize="words" autoComplete="name-family" textContentType="familyName" maxLength={80} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} />
      )} />
      <Controller control={control} name="phone" rules={{ validate: (value) => !value.trim() || /^\+?[\d\s-]{7,20}$/.test(value.trim()) || 'Enter a valid phone number' }} render={({ field }) => (
        <AppTextField label="Mobile number (optional)" placeholder="e.g. 077 123 4567" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={32} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.phone?.message} />
      )} />
      <Controller control={control} name="email" rules={{ validate: (value) => !value.trim() || emailPattern.test(value.trim()) || 'Enter a valid email address' }} render={({ field }) => (
        <AppTextField label="Email (optional)" placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={320} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />
      )} />
      <AppInlineError message={errors.root?.message} />
      <AppButton label="Save customer" loading={create.isPending} onPress={() => void handleSubmit(submit)()} />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  toolbar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  add: { minHeight: 46 },
  rowWrap: { borderLeftWidth: 1, borderRightWidth: 1, overflow: 'hidden' },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: 1 },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderBottomWidth: 1 },
});
