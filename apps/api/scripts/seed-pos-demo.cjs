// Opt-in isolated development data. Never run against production.
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
  const suffix = randomUUID().slice(0, 8), password = randomBytes(18).toString('base64url') + '1!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  try {
    const result = await db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name: 'Serendib Salon Demo ' + suffix, slug: 'pos-demo-' + suffix } });
      const branches = [];
      for (const data of [{ name: 'Colombo - Cinnamon Gardens', code: 'CMB', address: 'Demo location, Colombo 07, Sri Lanka' }, { name: 'Kandy - Lake Road', code: 'KDY', address: 'Demo location, Kandy, Sri Lanka' }]) branches.push(await tx.branch.create({ data: { tenantId: tenant.id, timezone: 'Asia/Colombo', ...data } }));
      const users = [];
      for (const [role, displayName, branchIndex] of [['OWNER','Nethmi Perera',0],['MANAGER','Kavindu Silva',1],['CASHIER','Dilini Fernando',0],['STYLIST','Amaya Jayasinghe',0]]) {
        const user = await tx.user.create({ data: { email: 'pos-' + role.toLowerCase() + '-' + suffix + '@example.invalid', displayName, passwordHash, emailVerifiedAt: new Date() } });
        await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role } });
        await tx.staffProfile.create({ data: { tenantId: tenant.id, branchId: branches[branchIndex].id, userId: user.id, title: role === 'STYLIST' ? 'Senior stylist' : role } });
        users.push({ role, email: user.email });
      }
      for (const data of [
        { name: 'Precision Haircut', type: 'SERVICE', category: 'Hair', priceLkr: '2500.00', durationMinutes: 45 },
        { name: 'Wash & Blow Dry', type: 'SERVICE', category: 'Hair', priceLkr: '1800.00', durationMinutes: 30 },
        { name: 'Beard Shape & Finish', type: 'SERVICE', category: 'Grooming', priceLkr: '1200.00', durationMinutes: 20 },
        { name: 'Express Manicure', type: 'SERVICE', category: 'Nails', priceLkr: '2200.00', durationMinutes: 30 },
        { name: 'Coconut Repair Shampoo 250ml', type: 'PRODUCT', category: 'Hair care', priceLkr: '1850.00', trackInventory: true },
        { name: 'Argan Finishing Serum 50ml', type: 'PRODUCT', category: 'Hair care', priceLkr: '3250.00', trackInventory: true },
        { name: 'Matte Styling Clay 75g', type: 'PRODUCT', category: 'Grooming', priceLkr: '2450.00', trackInventory: true },
      ]) {
        const item = await tx.catalogItem.create({ data: { tenantId: tenant.id, ...data } });
        if (item.trackInventory) {
          for (const branch of branches) {
            await tx.stockBalance.create({ data: { tenantId: tenant.id, branchId: branch.id, itemId: item.id, quantity: '15' } });
            await tx.inventoryMovement.create({ data: { tenantId: tenant.id, branchId: branch.id, itemId: item.id, delta: '15', balanceAfter: '15', kind: 'OPENING', reason: 'Demo opening count' } });
          }
          await tx.catalogItem.update({ where: { id: item.id }, data: { stockQuantity: '30' } });
        }
        if (data.name === 'Precision Haircut') await tx.branchPrice.create({ data: { tenantId: tenant.id, branchId: branches[1].id, itemId: item.id, priceLkr: '2300.00' } });
      }
      await tx.customer.createMany({ data: [
        { tenantId: tenant.id, firstName: 'Sanduni', lastName: 'Perera', phone: '0770000001' },
        { tenantId: tenant.id, firstName: 'Dinesh', lastName: 'Silva', phone: '0770000002' },
        { tenantId: tenant.id, firstName: 'Fathima', lastName: 'Rizvi', phone: '0770000003' },
      ] });
      await tx.auditLog.create({ data: { tenantId: tenant.id, action: 'DEMO_SEEDED', entityType: 'Tenant', entityId: tenant.id, metadata: { demo: true } } });
      return { business: tenant.name, tenantId: tenant.id, users };
    }, { timeout: 60000 });
    console.log('Created isolated Sri Lankan DEMO data. Names and phone numbers are fictitious.');
    console.log('Business: ' + result.business + ' / ' + result.tenantId);
    for (const user of result.users) console.log(user.role + ': ' + user.email);
    console.log('Temporary demo password for all four accounts: ' + password);
    console.log('Keep credentials local. Open a cash shift before selling. Tax defaults to zero; configure your own valid tax settings.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
