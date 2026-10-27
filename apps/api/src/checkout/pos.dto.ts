import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { moneyPattern } from './dto';
export class BranchPriceDto {
  @Matches(moneyPattern) priceLkr!: string;
  @IsInt() @Min(0) @Max(10000) taxRateBps = 0;
  @IsString() @MinLength(1) @MaxLength(80) taxLabel = 'No tax';
  @IsBoolean() active = true;
}
export class StockAdjustmentDto {
  @IsUUID() branchId!: string;
  @IsUUID() itemId!: string;
  @Matches(/^-?[1-9]\d{0,5}$/) delta!: string;
  @IsString() @MinLength(3) @MaxLength(255) reason!: string;
}
export class StockPolicyDto {
  @IsIn(['REJECT', 'ALLOW_NEGATIVE']) policy!: string;
}
export class VoidDto {
  @IsString() @MinLength(3) @MaxLength(255) reason!: string;
}
export class PosCustomerDto {
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @Matches(/^\+?[\d -]{7,20}$/) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
}
