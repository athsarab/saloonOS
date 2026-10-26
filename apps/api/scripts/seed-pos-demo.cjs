// Explicitly opt-in development data for the Android checkout checklist.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { parse } = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

async function main() {
  const config = parse(readFileSync(join(__dirname, '..', '.env')));
  if (config.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') throw new Error('Demo data is disabled in production');
  const db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
  const suffix = randomUUID().slice(0, 8);
  const password = randomBytes(18).toString('base64url') + '1!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  try {
    const result = await db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name: 'POS Demo ' + suffix, slug: 'pos-demo-' + suffix } });
      const branch = await tx.branch.create({ data: { tenantId: tenant.id, name: 'Demo Studio', code: 'DEMO', timezone: 'Asia/Colombo' } });
      const users = [];
      for (const role of ['OWNER', 'CASHIER', 'STYLIST']) {
        const user = await tx.user.create({ data: { email: 'pos-' + role.toLowerCase() + '-' + suffix + '@example.invalid', displayName: 'Demo ' + role.toLowerCase(), passwordHash, emailVerifiedAt: new Date() } });
        await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role } });
        users.push({ role, email: user.email, id: user.id });
      }
      await tx.staffProfile.create({ data: { tenantId: tenant.id, branchId: branch.id, userId: users[2].id, title: 'Professional' } });
      await tx.catalogItem.createMany({ data: [
        { tenantId: tenant.id, name: 'Precision Cut', type: 'SERVICE', category: 'Hair', priceLkr: '100.25', durationMinutes: 30 },
        { tenantId: tenant.id, name: 'Daily Shampoo', type: 'PRODUCT', category: 'Care', priceLkr: '19.99', trackInventory: true, stockQuantity: '5' },
      ] });
      await tx.customer.create({ data: { tenantId: tenant.id, firstName: 'Demo', lastName: 'Customer', phone: '0770000000' } });
      return { tenantId: tenant.id, business: tenant.name, users };
    }, { timeout: 30000 });
    console.log('Created an isolated DEMO business. These are not real customer accounts.');
    console.log('Business: ' + result.business);
    console.log('Business ID: ' + result.tenantId);
    for (const user of result.users) console.log(user.role + ': ' + user.email);
    console.log('Temporary demo password for all three accounts: ' + password);
    console.log('Keep these credentials local. Use this business only for test transactions.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
