import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, Screen } from '../../src/components/ui';

export default function AppointmentsScreen() {
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}><AppHeader title="Appointments" description="Keep the day moving without losing the personal touch." /><Card><EmptyState title="No appointments yet" description="Once your workspace is connected, today’s appointments will be ready here." /></Card></ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 20, padding: 20 } });
