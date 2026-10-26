import { PaymentMethod } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const moneyPattern = /^\d{1,10}(?:\.\d{1,2})?$/;

export class CheckoutLineDto {
  @IsUUID() itemId!: string;
  @Matches(/^[1-9]\d{0,5}$/) quantity!: string;
  @IsOptional() @IsUUID() assignedStaffProfileId?: string;
  @IsOptional() @Matches(moneyPattern) expectedUnitPriceLkr?: string;
}
export class CheckoutDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CheckoutLineDto) items!: CheckoutLineDto[];
  @Matches(moneyPattern) discountLkr = '0';
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @IsOptional() @Matches(moneyPattern) cashReceivedLkr?: string;
  @IsOptional() @IsString() @MaxLength(120) bankReference?: string;
  @IsOptional() @Matches(moneyPattern) expectedTotalLkr?: string;
}
export class SalesQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
export class RefundDto {
  @Matches(moneyPattern) amountLkr!: string;
  @IsString() @MinLength(3) @MaxLength(255) reason!: string;
}
export class OpenShiftDto {
  @IsUUID() branchId!: string;
  @Matches(moneyPattern) openingAmountLkr!: string;
}
export class CloseShiftDto {
  @Matches(moneyPattern) closingAmountLkr!: string;
}
export class VerifyTransferDto {
  @IsOptional() @IsIn(['VERIFIED', 'FAILED']) status: 'VERIFIED' | 'FAILED' = 'VERIFIED';
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}
export class CatalogDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsIn(['SERVICE', 'PRODUCT']) type!: 'SERVICE' | 'PRODUCT';
  @Matches(moneyPattern) priceLkr!: string;
  @IsOptional() @IsBoolean() trackInventory = false;
  @Matches(/^\d{1,7}$/) stockQuantity = '0';
}
