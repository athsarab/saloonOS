import { useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react-native';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppDialog } from '../../src/components/AppDialog';
import { AppHeader } from '../../src/components/AppHeader';
import { AppSearchBar } from '../../src/components/AppSearchBar';
import { AppStatusBadge } from '../../src/components/AppStatusBadge';
import { AppEmptyState, AppErrorState, AppInlineError, AppLoadingState } from '../../src/components/AppStates';
import { AppTextField } from '../../src/components/AppTextField';
import { useToast } from '../../src/components/AppToast';
import { Screen } from '../../src/components/ui';
import { useBranches } from '../../src/lib/checkout-api';
import { friendlyError } from '../../src/lib/errors';
import { feedback } from '../../src/lib/feedback';
import { appointmentStatus, formatDateTime, fullName } from '../../src/lib/format';
import { usePermissions } from '../../src/lib/permissions';
import { Appointment, AppointmentInput, useAppointment, useAppointments, useCreateAppointment, useCustomerList, useSalonServices, useSalonStaff, useUpdateAppointment } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, layout, radius, spacing, type } from '../../src/theme/tokens';

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
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const appointments = useAppointments(parseDate(date), { status });
  const filtered = (appointments.data?.items ?? []).filter((item) => `${fullName(item.customer)} ${item.service?.name ?? ''} ${item.staffProfile?.user?.displayName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const hasFilters = Boolean(search.trim() || status);
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
              <StatusDropdown value={status} onChange={setStatus} />
            </View>
          }
          ListEmptyComponent={
            appointments.isPending ? <AppLoadingState label="Loading appointments…" /> :
              appointments.isError ? <AppErrorState title="Couldn’t load appointments" message={friendlyError(appointments.error, { fallback: feedback.appointment.loadFailed })} onRetry={() => void appointments.refetch()} retrying={appointments.isFetching} /> :
                <AppEmptyState icon={<CalendarDays color={colors.textSubtle} size={iconSize.lg} />} title={hasFilters ? 'No matching appointments' : 'No appointments scheduled for this day.'} description={hasFilters ? 'Try another search or filter' : ''} action={can('appointments.write') ? <AppButton label="Create appointment" fullWidth={false} onPress={() => { setEditing(null); setFormOpen(true); }} /> : undefined} />
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

function StatusDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const options = ['', 'BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  const selectedLabel = value ? appointmentStatus[value]?.label ?? value : 'All statuses';
  return <View style={styles.dropdownGroup}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={[styles.dropdownTrigger, { backgroundColor: colors.surface, borderColor: open ? colors.focus : colors.borderStrong }]}>
      <View style={styles.dropdownCopy}><Text style={[type.caption, { color: colors.textMuted }]}>Status</Text><Text style={[type.bodyStrong, { color: colors.text }]}>{selectedLabel}</Text></View>
      <ChevronDown color={colors.textMuted} size={iconSize.md} style={open ? styles.chevronOpen : undefined} />
    </Pressable>
    {open ? <View style={[styles.dropdownMenu, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, shadowColor: colors.text }]}>
      {options.map((option) => <Pressable key={option || 'all'} accessibilityRole="menuitem" onPress={() => { onChange(option); setOpen(false); }} style={[styles.dropdownOption, { backgroundColor: value === option ? colors.primarySoft : 'transparent' }]}>
        <Text style={[type.body, { color: colors.text }]}>{option ? appointmentStatus[option]?.label ?? option : 'All statuses'}</Text>
        {value === option ? <Check color={colors.primary} size={iconSize.md} /> : null}
      </Pressable>)}
    </View> : null}
  </View>;
}

function AppointmentDetail({ appointment, visible, canEdit, loading, onClose, onEdit }: { appointment?: Appointment & { branch?: { name: string; timezone: string }; notes?: string | null }; visible: boolean; canEdit: boolean; loading: boolean; onClose: () => void; onEdit: (item: Appointment) => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const update = useUpdateAppointment();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const cancel = async () => {
    if (!appointment) return;
    setCancelError('');
    try {
      await update.mutateAsync({ id: appointment.id, status: 'CANCELLED' });
      setConfirmCancel(false);
      toast.show('Appointment cancelled successfully.');
      onClose();
    } catch (reason) {
      setCancelError(friendlyError(reason, { fallback: feedback.appointment.saveFailed }));
    }
  };
  return <><AppBottomSheet visible={visible} title="Appointment details" onClose={onClose} locked={update.isPending}>
    {loading ? <AppLoadingState label="Loading appointment…" /> : appointment ? <View style={styles.sheetContent}>
      <AppInlineError message={cancelError} />
      <AppStatusBadge label={appointmentStatus[appointment.status]?.label ?? appointment.status} tone={appointmentStatus[appointment.status]?.tone ?? 'neutral'} />
      <Text style={[type.heading, { color: colors.text }]}>{fullName(appointment.customer)}</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{appointment.service?.name ?? 'Service'} · {formatDateTime(appointment.startsAt, appointment.branch?.timezone)}</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{appointment.staffProfile?.user?.displayName ?? 'Any available staff'}{appointment.branch?.name ? ` · ${appointment.branch.name}` : ''}</Text>
      {appointment.notes ? <Text style={[type.body, { color: colors.text }]}>{appointment.notes}</Text> : null}
      {canEdit && !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status) ? <><AppButton label="Edit or reschedule" onPress={() => onEdit(appointment)} /><AppButton label="Cancel appointment" variant="danger" onPress={() => setConfirmCancel(true)} /></> : null}
    </View> : null}
  </AppBottomSheet><AppDialog visible={confirmCancel} title="Cancel this appointment?" message="This action may not be reversible." confirmLabel="Cancel appointment" tone="danger" loading={update.isPending} onConfirm={() => void cancel()} onCancel={() => setConfirmCancel(false)} /></>;
}

type SelectionOption = { id: string; label: string };

function SelectionDropdown({ label, value, placeholder, options, onChange, clearable = false }: { label: string; value?: string; placeholder: string; options: SelectionOption[]; onChange: (value: string) => void; clearable?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return <View style={styles.fieldGroup}>
    <Text numberOfLines={1} style={[type.label, styles.fieldLabel, { color: colors.text }]}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={[styles.dropdownTrigger, styles.inlineControl, { backgroundColor: colors.input, borderColor: open ? colors.focus : colors.borderStrong }]}>
      <Text numberOfLines={1} style={[type.body, { color: value ? colors.text : colors.inputPlaceholder }]}>{value ?? placeholder}</Text>
      <ChevronDown color={colors.textMuted} size={iconSize.md} style={open ? styles.chevronOpen : undefined} />
    </Pressable>
    {open ? <View style={[styles.dropdownMenu, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, shadowColor: colors.text }]}>
      {clearable ? <Pressable onPress={() => { onChange(''); setOpen(false); }} style={[styles.dropdownOption, { backgroundColor: !value ? colors.primarySoft : 'transparent' }]}><Text style={[type.body, { color: colors.textMuted }]}>Any available staff</Text>{!value ? <Check color={colors.primary} size={iconSize.md} /> : null}</Pressable> : null}
      {options.map((option) => <Pressable key={option.id} onPress={() => { onChange(option.id); setOpen(false); }} style={[styles.dropdownOption, { backgroundColor: value === option.id ? colors.primarySoft : 'transparent' }]}><Text numberOfLines={1} style={[type.body, styles.optionLabel, { color: colors.text }]}>{option.label}</Text>{value === option.label || value === option.id ? <Check color={colors.primary} size={iconSize.md} /> : null}</Pressable>)}
      {!options.length ? <Text style={[type.caption, styles.emptyOption, { color: colors.textMuted }]}>No options available</Text> : null}
    </View> : null}
  </View>;
}

function PickerField({ label, value, icon, onPress }: { label: string; value: string; icon: ReactNode; onPress: () => void }) {
  const { colors } = useTheme();
  return <View style={styles.fieldGroup}>
    <Text numberOfLines={1} style={[type.label, styles.fieldLabel, { color: colors.text }]}>{label}<Text style={{ color: colors.danger }}> *</Text></Text>
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.pickerField, styles.inlineControl, { backgroundColor: colors.input, borderColor: colors.borderStrong }]}>
      {icon}<Text style={[type.body, { color: colors.text }]}>{value}</Text><ChevronDown color={colors.textMuted} size={iconSize.md} />
    </Pressable>
  </View>;
}

function DateTimePickerModal({ type: pickerType, value, onClose, onChange }: { type: 'date' | 'time' | null; value: string; onClose: () => void; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);
  const isDate = pickerType === 'date';
  const date = isDate ? parseDate(draft) : new Date();
  const shiftDate = (days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); setDraft(dateKey(next)); };
  const timeOptions = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
  return <Modal visible={pickerType !== null} transparent animationType="fade" onRequestClose={onClose}>
    <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
      <View style={[styles.pickerModal, { backgroundColor: colors.surfaceRaised }]}>
        <View style={styles.modalHeader}><View><Text style={[type.heading, { color: colors.text }]}>{isDate ? 'Choose date' : 'Choose start time'}</Text><Text style={[type.caption, { color: colors.textMuted }]}>{isDate ? 'Select the appointment day' : 'Select a convenient time'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close picker" onPress={onClose}><Text style={[type.heading, { color: colors.textMuted }]}>×</Text></Pressable></View>
        {isDate ? <View style={styles.datePickerBody}>
          <View style={styles.dateNav}><Pressable onPress={() => shiftDate(-1)} style={styles.dateNavButton}><ChevronLeft color={colors.text} size={iconSize.md} /></Pressable><Text style={[type.bodyStrong, { color: colors.text }]}>{date.toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => shiftDate(1)} style={styles.dateNavButton}><ChevronRight color={colors.text} size={iconSize.md} /></Pressable></View>
          <Pressable onPress={() => setDraft(dateKey(new Date()))} style={[styles.todayButton, { backgroundColor: colors.primarySoft }]}><Text style={[type.bodyStrong, { color: colors.primary }]}>Today</Text></Pressable>
        </View> : <View style={styles.timeGrid}>{timeOptions.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={[styles.timeOption, { backgroundColor: draft === option ? colors.primary : colors.surfaceMuted, borderColor: draft === option ? colors.primary : colors.border }]}><Text style={[type.bodyStrong, { color: draft === option ? colors.onPrimary : colors.text }]}>{option}</Text></Pressable>)}</View>}
        {isDate ? <AppButton label="Use this date" onPress={() => onChange(draft)} /> : null}
      </View>
    </View>
  </Modal>;
}

function AppointmentForm({ visible, appointment, onClose }: { visible: boolean; appointment: Appointment | null; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const branches = useBranches(), customers = useCustomerList(''), services = useSalonServices(), staff = useSalonStaff();
  const create = useCreateAppointment(), update = useUpdateAppointment();
  const [branchId, setBranchId] = useState(appointment?.branchId ?? ''), [customerId, setCustomerId] = useState(appointment?.customerId ?? ''), [serviceId, setServiceId] = useState(appointment?.serviceId ?? ''), [staffId, setStaffId] = useState(appointment?.staffProfileId ?? ''), [date, setDate] = useState(appointment ? dateKey(new Date(appointment.startsAt)) : dateKey(new Date())), [time, setTime] = useState(appointment ? new Date(appointment.startsAt).toTimeString().slice(0, 5) : '09:00'), [notes, setNotes] = useState(appointment?.notes ?? ''), [error, setError] = useState(''), [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const isEdit = !!appointment;
  const submit = async () => {
    setError('');
    if (!branchId || !customerId || !serviceId || !date || !time) { setError('Please select a branch, customer, service, date and time before continuing.'); return; }
    try {
      const payload: AppointmentInput = { branchId, customerId, serviceId, staffProfileId: staffId || undefined, startsAt: localStart(date, time), notes: notes.trim() || undefined };
      if (appointment) await update.mutateAsync({ ...payload, id: appointment.id }); else await create.mutateAsync(payload);
      toast.show(appointment ? 'Appointment updated successfully.' : 'Appointment booked successfully.');
      onClose();
    } catch (reason) { setError(friendlyError(reason, { fallback: feedback.appointment.saveFailed, byStatus: { 409: feedback.appointment.conflict } })); }
  };
  const open = visible;
  if (!open) return null;
  return <AppBottomSheet visible title={isEdit ? 'Edit appointment' : 'Create appointment'} onClose={onClose} locked={create.isPending || update.isPending}>
    <AppInlineError message={error} />
    <SelectionDropdown label="Branch" value={branches.data?.find((item) => item.id === branchId)?.name} placeholder="Select a branch" options={(branches.data ?? []).map((item) => ({ id: item.id, label: item.name }))} onChange={setBranchId} />
    {!isEdit ? <SelectionDropdown label="Customer" value={customers.data?.items.find((item) => item.id === customerId) ? fullName(customers.data.items.find((item) => item.id === customerId)!) : undefined} placeholder="Select a customer" options={(customers.data?.items ?? []).slice(0, 20).map((item) => ({ id: item.id, label: fullName(item) }))} onChange={setCustomerId} /> : null}
    <Text style={[type.label, { color: colors.text }]}>Service</Text><View style={styles.wrap}>{services.data?.items.map((item) => <FilterChip key={item.id} label={`${item.name} · ${item.durationMinutes ?? '?'} min`} selected={serviceId === item.id} onPress={() => setServiceId(item.id)} />)}</View>
    <SelectionDropdown label="Staff (optional)" value={staff.data?.find((item) => item.id === staffId)?.user.displayName} placeholder="Any available staff" options={(staff.data?.filter((item) => !branchId || item.branchId === branchId) ?? []).map((item) => ({ id: item.id, label: item.user.displayName }))} clearable onChange={setStaffId} />
    <PickerField label="Date" value={date} icon={<CalendarDays color={colors.primary} size={iconSize.md} />} onPress={() => setPicker('date')} />
    <PickerField label="Start time" value={time} icon={<Clock3 color={colors.primary} size={iconSize.md} />} onPress={() => setPicker('time')} />
    <AppTextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={500} />
    <AppButton label={isEdit ? 'Save changes' : 'Book appointment'} loading={create.isPending || update.isPending} onPress={() => void submit()} />
    {picker ? <DateTimePickerModal key={picker} type={picker} value={picker === 'date' ? date : time} onClose={() => setPicker(null)} onChange={(value) => { if (picker === 'date') setDate(value); else setTime(value); setPicker(null); }} /> : null}
  </AppBottomSheet>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { gap: spacing.md, padding: spacing.lg, paddingBottom: layout.screenBottomInset }, header: { gap: spacing.md }, dateBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderRadius: radius.pill, borderWidth: 1, minHeight: 36, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, cardGap: { marginTop: spacing.sm }, row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 72, padding: spacing.lg }, copy: { flex: 1, gap: spacing.xs }, sheetContent: { gap: spacing.md },
  dropdownGroup: { gap: spacing.xs, zIndex: 2 },
  fieldGroup: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 54, zIndex: 2 },
  fieldLabel: { flexShrink: 0, width: 112 },
  inlineControl: { flex: 1 },
  dropdownTrigger: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: spacing.md },
  dropdownCopy: { flex: 1, gap: spacing.xxs },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  dropdownMenu: { borderRadius: radius.md, borderWidth: 1, elevation: 4, marginTop: spacing.xs, overflow: 'hidden', shadowOpacity: 0.12, shadowRadius: 10 },
  dropdownOption: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md },
  optionLabel: { flex: 1 },
  emptyOption: { padding: spacing.md },
  pickerField: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 54, paddingHorizontal: spacing.md },
  modalBackdrop: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  pickerModal: { borderRadius: radius.xl, gap: spacing.lg, maxWidth: 420, padding: spacing.xl, width: '100%' },
  modalHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  datePickerBody: { alignItems: 'center', gap: spacing.lg },
  dateNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  dateNavButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  todayButton: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeOption: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, minWidth: '30%', paddingVertical: spacing.md },
});
