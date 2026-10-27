import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ROLE_PERMISSIONS, Permission } from '../auth/auth.constants';
import { zero } from './money';

export type Tx = Prisma.TransactionClient;
export async function permittedBranches(tx: Tx, tenantId: string, userId: string) {
  const member = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
  if (!member || !ROLE_PERMISSIONS[member.role].includes(Permission.CHECKOUT)) throw new ForbiddenException('Checkout access required');
  return ['OWNER', 'MANAGER'].includes(member.role) ? undefined :
    (await tx.staffProfile.findMany({ where: { tenantId, userId, active: true }, select: { branchId: true } })).map(s => s.branchId);
}
export async function requireBranch(tx: Tx, tenantId: string, userId: string, branchId: string) {
  if (!branchId) throw new BadRequestException("A branchId is required");
  const allowed = await permittedBranches(tx, tenantId, userId);
  if (allowed && !allowed.includes(branchId)) throw new ForbiddenException('You are not assigned to this branch');
  const branch = await tx.branch.findFirst({ where: { tenantId, id: branchId } });
  if (!branch) throw new NotFoundException('Branch not found');
  return branch;
}
export async function ensureStock(tx: Tx, tenantId: string, branchId: string, itemId: string) {
  const where = { tenantId_branchId_itemId: { tenantId, branchId, itemId } };
  const existing = await tx.stockBalance.findUnique({ where });
  if (existing) return existing;
  // Legacy global stock is imported only when there is exactly one branch.
  const branches = await tx.branch.count({ where: { tenantId } });
  const item = await tx.catalogItem.findFirstOrThrow({ where: { tenantId, id: itemId } });
  const quantity = branches === 1 ? item.stockQuantity : zero();
  const balance = await tx.stockBalance.create({ data: { tenantId, branchId, itemId, quantity } });
  await tx.inventoryMovement.create({ data: { tenantId, branchId, itemId, delta: quantity, balanceAfter: quantity, kind: 'OPENING', reason: branches === 1 ? 'Imported legacy single-branch stock' : 'New branch stock balance' } });
  return balance;
}
export async function moveStock(tx: Tx, tenantId: string, branchId: string, itemId: string, delta: Prisma.Decimal, kind: string, reason: string, actorUserId: string, saleId?: string) {
  await ensureStock(tx, tenantId, branchId, itemId);
  const branch = await tx.branch.findFirstOrThrow({ where: { tenantId, id: branchId } });
  const changed = await tx.stockBalance.updateMany({
    where: { tenantId, branchId, itemId, ...(delta.lt(0) && branch.stockPolicy !== 'ALLOW_NEGATIVE' ? { quantity: { gte: delta.neg() } } : {}) },
    data: { quantity: { increment: delta } },
  });
  if (changed.count !== 1) throw new ConflictException('Insufficient stock for this branch');
  const balance = await tx.stockBalance.findUniqueOrThrow({ where: { tenantId_branchId_itemId: { tenantId, branchId, itemId } } });
  // Compatibility aggregate for existing native catalog consumers; branch balances are authoritative.
  const sum = await tx.stockBalance.aggregate({ where: { tenantId, itemId }, _sum: { quantity: true } });
  await tx.catalogItem.updateMany({ where: { tenantId, id: itemId }, data: { stockQuantity: sum._sum.quantity ?? zero() } });
  await tx.inventoryMovement.create({ data: { tenantId, branchId, itemId, delta, balanceAfter: balance.quantity, kind, reason, actorUserId, saleId } });
  return balance;
}

// Allocate an order discount in cents with largest remainders. Ties use stable item/staff keys.
export function allocateDiscount(lines: { key: string; gross: Prisma.Decimal }[], discount: Prisma.Decimal) {
  const cents = (d: Prisma.Decimal) => BigInt(d.mul(100).toFixed(0));
  const total = lines.reduce((sum, l) => sum + cents(l.gross), 0n), target = cents(discount);
  const shares = lines.map((l, index) => ({ index, key: l.key, amount: total ? cents(l.gross) * target / total : 0n, remainder: total ? cents(l.gross) * target % total : 0n }));
  let left = target - shares.reduce((sum, s) => sum + s.amount, 0n);
  for (const s of [...shares].sort((a, b) => a.remainder === b.remainder ? a.key.localeCompare(b.key) : a.remainder > b.remainder ? -1 : 1)) {
    if (left > 0n) { s.amount++; left--; }
  }
  return shares.map(s => new Prisma.Decimal(s.amount.toString()).div(100));
}
