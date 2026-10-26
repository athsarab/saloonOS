import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { moneyPattern } from './dto';

export const zero = () => new Prisma.Decimal('0');
export function money(value: string | Prisma.Decimal): Prisma.Decimal {
  if (typeof value === 'string' && !moneyPattern.test(value)) throw new BadRequestException('Amounts must be decimal strings with at most two decimal places');
  const result = new Prisma.Decimal(value);
  if (!result.isFinite() || result.isNegative() || result.gt('9999999999.99') || result.decimalPlaces() > 2) throw new BadRequestException('Amount is out of range');
  return result;
}
