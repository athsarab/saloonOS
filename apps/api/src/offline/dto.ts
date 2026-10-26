import { Type } from 'class-transformer';
import { IsDateString, IsDefined, IsObject, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CheckoutDto } from '../checkout/dto';
export class RegisterOfflineDeviceDto {
  @IsUUID() id!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
}
export class PrepareOfflineDto {
  @IsUUID() deviceId!: string;
  @IsUUID() branchId!: string;
}
export class SyncCashDto {
  @IsUUID() deviceId!: string;
  @IsUUID() operationId!: string;
  @IsUUID() grantId!: string;
  @IsDateString() recordedAt!: string;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => CheckoutDto) checkout!: CheckoutDto;
}
