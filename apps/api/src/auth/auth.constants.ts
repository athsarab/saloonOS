import { MembershipRole } from '@prisma/client';

export enum Permission {
  BUSINESS_SETTINGS_READ = 'business.settings.read',
  BUSINESS_SETTINGS_WRITE = 'business.settings.write',
  STAFF_READ = 'staff.read',
  STAFF_WRITE = 'staff.write',
  APPOINTMENTS_READ = 'appointments.read',
  APPOINTMENTS_WRITE = 'appointments.write',
  CHECKOUT = 'checkout',
  REFUNDS = 'refunds',
  INVENTORY_READ = 'inventory.read',
  INVENTORY_WRITE = 'inventory.write',
  REPORTS_READ = 'reports.read',
}

export const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  OWNER: Object.values(Permission),
  MANAGER: [
    Permission.BUSINESS_SETTINGS_READ, Permission.BUSINESS_SETTINGS_WRITE,
    Permission.STAFF_READ, Permission.STAFF_WRITE,
    Permission.APPOINTMENTS_READ, Permission.APPOINTMENTS_WRITE,
    Permission.CHECKOUT, Permission.REFUNDS,
    Permission.INVENTORY_READ, Permission.INVENTORY_WRITE, Permission.REPORTS_READ,
  ],
  CASHIER: [Permission.BUSINESS_SETTINGS_READ, Permission.APPOINTMENTS_READ, Permission.CHECKOUT, Permission.INVENTORY_READ],
  STYLIST: [Permission.BUSINESS_SETTINGS_READ, Permission.APPOINTMENTS_READ, Permission.APPOINTMENTS_WRITE],
};
