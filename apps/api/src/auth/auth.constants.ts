import { MembershipRole } from '@prisma/client';

export enum Permission {
  BUSINESS_SETTINGS_READ = 'business.settings.read',
  BUSINESS_SETTINGS_WRITE = 'business.settings.write',
  STAFF_READ = 'staff.read',
  STAFF_WRITE = 'staff.write',
  APPOINTMENTS_READ = 'appointments.read',
  APPOINTMENTS_WRITE = 'appointments.write',
  CHECKOUT = 'checkout',
  DISCOUNTS = 'discounts',
  REFUNDS = 'refunds',
  VOIDS = 'voids',
  PAYMENTS_VERIFY = 'payments.verify',
  INVENTORY_READ = 'inventory.read',
  INVENTORY_WRITE = 'inventory.write',
  REPORTS_READ = 'reports.read',
  CUSTOMER_READ = 'customer.read',
  CUSTOMER_WRITE = 'customer.write',
  SERVICES_READ = 'services.read',
  SERVICES_WRITE = 'services.write',
  STAFF_SCHEDULE_WRITE = 'staff.schedule.write',
}

export const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  OWNER: Object.values(Permission),
  MANAGER: [
    Permission.BUSINESS_SETTINGS_READ, Permission.BUSINESS_SETTINGS_WRITE,
    Permission.STAFF_READ, Permission.STAFF_WRITE,
    Permission.APPOINTMENTS_READ, Permission.APPOINTMENTS_WRITE,
    Permission.CHECKOUT, Permission.DISCOUNTS, Permission.REFUNDS, Permission.VOIDS, Permission.PAYMENTS_VERIFY,
    Permission.INVENTORY_READ, Permission.INVENTORY_WRITE, Permission.REPORTS_READ,
    Permission.CUSTOMER_READ, Permission.CUSTOMER_WRITE, Permission.SERVICES_READ, Permission.SERVICES_WRITE, Permission.STAFF_SCHEDULE_WRITE,
  ],
  CASHIER: [Permission.BUSINESS_SETTINGS_READ, Permission.APPOINTMENTS_READ, Permission.CHECKOUT, Permission.INVENTORY_READ, Permission.CUSTOMER_READ, Permission.CUSTOMER_WRITE, Permission.SERVICES_READ],
  STYLIST: [Permission.BUSINESS_SETTINGS_READ, Permission.APPOINTMENTS_READ, Permission.APPOINTMENTS_WRITE, Permission.CUSTOMER_READ, Permission.CUSTOMER_WRITE, Permission.SERVICES_READ],
};
