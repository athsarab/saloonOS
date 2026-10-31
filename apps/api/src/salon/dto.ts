import { AppointmentStatus, CatalogItemType, MembershipRole } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID, Matches, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBusinessDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(2) address?: string;
  @IsOptional() @IsBoolean() whatsappRemindersEnabled?: boolean;
}

export class BranchDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) code!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() timezone?: string;
}

export class ServiceDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(CatalogItemType) type: CatalogItemType = CatalogItemType.SERVICE;
  @IsPositive() priceLkr!: number;
  @IsInt() @Min(5) @Max(1440) durationMinutes!: number;
}

export class CustomerDto {
  @IsString() @MinLength(1) firstName!: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() notes?: string;
}

export class StaffDto {
  @IsUUID() userId!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() title?: string;
}

export class CreateStaffMemberDto {
  @IsString() @MinLength(2) displayName!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() title?: string;
  @IsEnum(MembershipRole) role: MembershipRole = MembershipRole.STYLIST;
}

export class ScheduleDto {
  @IsUUID() branchId!: string;
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startsAt!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endsAt!: string;
}

export class TimeOffDto {
  @IsUUID() branchId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() reason?: string;
}

export class AppointmentDto {
  @IsUUID() branchId!: string;
  @IsUUID() customerId!: string;
  @IsUUID() serviceId!: string;
  @IsOptional() @IsUUID() staffProfileId?: string;
  @IsDateString() startsAt!: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() staffProfileId?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
}

export class AppointmentQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsUUID() staffProfileId?: string;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}

export class CustomerQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}

export class DashboardQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}
