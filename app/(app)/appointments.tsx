import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppDialog } from '../../src/components/AppDialog';
import { AppHeader } from '../../src/components/AppHeader';
import { AppSearchBar } from '../../src/components/AppSearchBar';
import { AppStatusBadge } from '../../src/components/AppStatusBadge';
import { AppEmptyState, AppErrorState, AppInlineError, AppLoadingState } from '../../src/components/AppStates';
import { AppTextField } from '../../src/components/AppTextField';
import { Screen } from '../../src/components/ui';
import { useBranches } from '../../src/lib/checkout-api';
import { friendlyError } from '../../src/lib/errors';
import { feedback } from '../../src/lib/feedback';
import { appointmentStatus, formatDateTime, fullName } from '../../src/lib/format';
import { usePermissions } from '../../src/lib/permissions';
import { Appointment, AppointmentInput, useAppointment, useAppointments, useCreateAppointment, useCustomerList, useSalonServices, useSalonStaff, useUpdateAppointment } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, radius, spacing, type } from '../../src/theme/tokens';

const dateKey = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};
const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const localStart = (date: string, time: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
};

export default function AppointmentsScreen() {
  const { colors } = useTheme();
  const { can } = usePermissions();
  const [date, setDate] = useState(dateKey(new Date()));
  const [search, setSearch] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const appointments = useAppointments(parseDate(date), { staffProfileId: staffId, status });
  const staff = useSalonStaff();
  const filtered = (appointments.data?.items ?? []).filter((item) => `${fullName(item.customer)} ${item.service?.name ?? ''} ${item.staffProfile?.user?.displayName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = useAppointment(selectedId);
  const moveDate = (days: number) => { const next = parseDate(date); next.setDate(next.getDate() + days); setDate(dateKey(next)); };
  const label = parseDate(date).toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshing={appointments.isRefetching}
          onRefresh={() => void appointments.refetch()}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppHeader title="Appointments" description={label} right={can('appointments.write') ? <AppButton label="New" size="sm" fullWidth={false} icon={<Plus color={colors.onPrimary} size={iconSize.sm} />} onPress={() => { setEditing(null); setFormOpen(true); }} /> : undefined} />
              <View style={styles.dateBar}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => moveDate(-1)} style={styles.iconButton}><ChevronLeft color={colors.text} size={iconSize.lg} /></Pressable>
                <Text style={[type.bodyStrong, { color: colors.text }]}>{date === dateKey(new Date()) ? 'Today' : label}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => moveDate(1)} style={styles.iconButton}><ChevronRight color={colors.text} size={iconSize.lg} /></Pressable>
              </View>
              <AppSearchBar value={search} onChangeText={setSearch} placeholder="Search customer, service or staff" />
              <View style={styles.wrap}>
                <FilterChip label="All statuses" selected={!status} onPress={() => setStatus('')} />
                {['BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((value) => <FilterChip key={value} label={appointmentStatus[value]?.label ?? value} selected={status === value} onPress={() => setStatus(value)} />)}
              </View>
              {staff.data?.length ? <View style={styles.wrap}>{staff.data.map((item) => <FilterChip key={item.id} label={item.user.displayName} selected={staffId === item.id} onPress={() => setStaffId(staffId === item.id ? '' : item.id)} />)}</View> : null}
            </View>
          }
          ListEmptyComponent={
            appointments.isPending ? <AppLoadingState label="Loading appointments…" /> :
              appointments.isError ? <AppErrorState title="Couldn’t load appointments" message={friendlyError(appointments.error, { fallback: feedback.appointment.loadFailed })} onRetry={() => void appointments.refetch()} retrying={appointments.isFetching} /> :
                <AppEmptyState icon={<CalendarDays color={colors.textSubtle} size={iconSize.lg} />} title={search || status || staffId ? 'No matching appointments' : 'No appointments scheduled for this day.'} description={search || status || staffId ? 'Try another search or filter.' : 'Create an appointment to keep the day organized.'} action={can('appointments.write') ? <AppButton label="Create appointment" fullWidth={false} onPress={() => { setEditing(null); setFormOpen(true); }} /> : undefined} />
          }
          renderItem={({ item, index }) => (
            <AppCard padded={false} style={index > 0 ? styles.cardGap : undefined}>
              <Pressable accessibilityRole="button" accessibilityLabel={`View appointment for ${fullName(item.customer)}`} onPress={() => setSelectedId(item.id)}>
                <View style={styles.row}>
                  <View style={styles.copy}><Text style={[type.bodyStrong, { color: colors.text }]}>{new Date(item.startsAt).toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' })} · {fullName(item.customer)}</Text><Text style={[type.caption, { color: colors.textMuted }]}>{item.service?.name ?? 'Service'}{item.staffProfile?.user?.displayName ? ` · ${item.staffProfile.user.displayName}` : ''}</Text></View>
                  <AppStatusBadge label={appointmentStatus[item.status]?.label ?? item.status} tone={appointmentStatus[item.status]?.tone ?? 'neutral'} />
                </View>
              </Pressable>
            </AppCard>
          )}
        />
      </SafeAreaView>
      <AppointmentDetail appointment={selected.data} visible={!!selectedId} canEdit={can('appointments.write')} loading={selected.isPending} onClose={() => setSelectedId(undefined)} onEdit={(item) => { setSelectedId(undefined); setEditing(item); setFormOpen(true); }} />
      <AppointmentForm key={editing?.id ?? 'new'} visible={formOpen} appointment={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
    </Screen>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted, borderColor: selected ? colors.primary : colors.border }]}><Text style={[type.caption, { color: selected ? colors.primary : colors.text }]}>{label}</Text></Pressable>;
}

function AppointmentDetail({ appointment, visible, canEdit, loading, onClose, onEdit }: { appointment?: Appointment & { branch?: { name: string; timezone: string }; notes?: string | null }; visible: boolean; canEdit: boolean; loading: boolean; onClose: () => void; onEdit: (item: Appointment) => void }) {
  const { colors } = useTheme();
  const update = useUpdateAppointment();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = async () => { if (!appointment) return; await update.mutateAsync({ id: appointment.id, status: 'CANCELLED' }); setConfirmCancel(false); onClose(); };
  return <><AppBottomSheet visible={visible} title="Appointment details" onClose={onClose} locked={update.isPending}>
    {loading ? <AppLoadingState label="Loading appointment…" /> : appointment ? <View style={styles.sheetContent}>
      <AppStatusBadge label={appointmentStatus[appointment.status]?.label ?? appointment.status} tone={appointmentStatus[appointment.status]?.tone ?? 'neutral'} />
      <Text style={[type.heading, { color: colors.text }]}>{fullName(appointment.customer)}</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{appointment.service?.name ?? 'Service'} · {formatDateTime(appointment.startsAt, appointment.branch?.timezone)}</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{appointment.staffProfile?.user?.displayName ?? 'Any available staff'}{appointment.branch?.name ? ` · ${appointment.branch.name}` : ''}</Text>
      {appointment.notes ? <Text style={[type.body, { color: colors.text }]}>{appointment.notes}</Text> : null}
      {canEdit && !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status) ? <><AppButton label="Edit or reschedule" onPress={() => onEdit(appointment)} /><AppButton label="Cancel appointment" variant="danger" onPress={() => setConfirmCancel(true)} /></> : null}
    </View> : null}
  </AppBottomSheet><AppDialog visible={confirmCancel} title="Cancel this appointment?" message="This action may not be reversible." confirmLabel="Cancel appointment" tone="danger" loading={update.isPending} onConfirm={() => void cancel()} onCancel={() => setConfirmCancel(false)} /></>;
}

function AppointmentForm({ visible, appointment, onClose }: { visible: boolean; appointment: Appointment | null; onClose: () => void }) {
  const { colors } = useTheme();
  const branches = useBranches(), customers = useCustomerList(''), services = useSalonServices(), staff = useSalonStaff();
  const create = useCreateAppointment(), update = useUpdateAppointment();
  const [branchId, setBranchId] = useState(appointment?.branchId ?? ''), [customerId, setCustomerId] = useState(appointment?.customerId ?? ''), [serviceId, setServiceId] = useState(appointment?.serviceId ?? ''), [staffId, setStaffId] = useState(appointment?.staffProfileId ?? ''), [date, setDate] = useState(appointment ? dateKey(new Date(appointment.startsAt)) : dateKey(new Date())), [time, setTime] = useState(appointment ? new Date(appointment.startsAt).toTimeString().slice(0, 5) : '09:00'), [notes, setNotes] = useState(appointment?.notes ?? ''), [error, setError] = useState('');
  const isEdit = !!appointment;
  const submit = async () => {
    setError('');
    if (!branchId || !customerId || !serviceId || !date || !time) { setError('Please select a branch, customer, service, date and time before continuing.'); return; }
    try {
      const payload: AppointmentInput = { branchId, customerId, serviceId, staffProfileId: staffId || undefined, startsAt: localStart(date, time), notes: notes.trim() || undefined };
      if (appointment) await update.mutateAsync({ ...payload, id: appointment.id }); else await create.mutateAsync(payload);
      onClose();
    } catch (reason) { setError(friendlyError(reason, { fallback: feedback.appointment.saveFailed, byStatus: { 409: feedback.appointment.conflict } })); }
  };
  const open = visible;
  if (!open) return null;
  return <AppBottomSheet visible title={isEdit ? 'Edit appointment' : 'Create appointment'} onClose={onClose} locked={create.isPending || update.isPending}>
    <AppInlineError message={error} />
    <Text style={[type.label, { color: colors.text }]}>Branch</Text><View style={styles.wrap}>{branches.data?.map((item) => <FilterChip key={item.id} label={item.name} selected={branchId === item.id} onPress={() => setBranchId(item.id)} />)}</View>
    {!isEdit ? <><Text style={[type.label, { color: colors.text }]}>Customer</Text><View style={styles.wrap}>{customers.data?.items.slice(0, 20).map((item) => <FilterChip key={item.id} label={fullName(item)} selected={customerId === item.id} onPress={() => setCustomerId(item.id)} />)}</View></> : null}
    <Text style={[type.label, { color: colors.text }]}>Service</Text><View style={styles.wrap}>{services.data?.items.map((item) => <FilterChip key={item.id} label={`${item.name} · ${item.durationMinutes ?? '?'} min`} selected={serviceId === item.id} onPress={() => setServiceId(item.id)} />)}</View>
    <Text style={[type.label, { color: colors.text }]}>Staff (optional)</Text><View style={styles.wrap}>{staff.data?.filter((item) => !branchId || item.branchId === branchId).map((item) => <FilterChip key={item.id} label={item.user.displayName} selected={staffId === item.id} onPress={() => setStaffId(staffId === item.id ? '' : item.id)} />)}</View>
    <AppTextField label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
    <AppTextField label="Start time" value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" autoCapitalize="none" />
    <AppTextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={500} />
    <AppButton label={isEdit ? 'Save changes' : 'Book appointment'} loading={create.isPending || update.isPending} onPress={() => void submit()} />
  </AppBottomSheet>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl }, header: { gap: spacing.md }, dateBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderRadius: radius.pill, borderWidth: 1, minHeight: 36, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, cardGap: { marginTop: spacing.sm }, row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 72, padding: spacing.lg }, copy: { flex: 1, gap: spacing.xs }, sheetContent: { gap: spacing.md },
});
