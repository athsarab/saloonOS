import { useAuthStore } from './auth';

// UI visibility only — the API enforces every permission.
// Mirrors ROLE_PERMISSIONS in apps/api/src/auth/auth.constants.ts; keep the two in sync.
export type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | 'STYLIST';
export type Permission =
  | 'business.settings.read' | 'business.settings.write' | 'staff.read' | 'staff.write'
  | 'appointments.read' | 'appointments.write' | 'checkout' | 'discounts' | 'refunds' | 'voids'
  | 'payments.verify' | 'inventory.read' | 'inventory.write' | 'reports.read'
  | 'customer.read' | 'customer.write' | 'services.read' | 'services.write' | 'staff.schedule.write';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [
    'business.settings.read', 'business.settings.write', 'staff.read', 'staff.write', 'appointments.read', 'appointments.write',
    'checkout', 'discounts', 'refunds', 'voids', 'payments.verify', 'inventory.read', 'inventory.write', 'reports.read',
    'customer.read', 'customer.write', 'services.read', 'services.write', 'staff.schedule.write',
  ],
  MANAGER: [
    'business.settings.read', 'business.settings.write', 'staff.read', 'staff.write', 'appointments.read', 'appointments.write',
    'checkout', 'discounts', 'refunds', 'voids', 'payments.verify', 'inventory.read', 'inventory.write', 'reports.read',
    'customer.read', 'customer.write', 'services.read', 'services.write', 'staff.schedule.write',
  ],
  CASHIER: ['business.settings.read', 'appointments.read', 'checkout', 'inventory.read', 'customer.read', 'customer.write', 'services.read'],
  STYLIST: ['business.settings.read', 'appointments.read', 'appointments.write', 'customer.read', 'customer.write', 'services.read'],
};

export const roleLabel: Record<Role, string> = { OWNER: 'Owner', MANAGER: 'Manager', CASHIER: 'Cashier', STYLIST: 'Stylist' };

export function roleFromToken(token: string | null): Role | null {
  try {
    const encoded = token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { role?: string };
    return payload.role && payload.role in ROLE_PERMISSIONS ? (payload.role as Role) : null;
  } catch {
    return null;
  }
}

export function usePermissions() {
  const role = roleFromToken(useAuthStore((state) => state.accessToken));
  const granted = role ? ROLE_PERMISSIONS[role] : [];
  return { role, can: (permission: Permission) => granted.includes(permission) };
}
