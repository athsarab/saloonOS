import { IsEmail, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) displayName!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(2) businessName!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

export class TokenDto {
  @IsString() @MinLength(20) refreshToken!: string;
}

export class VerifyEmailDto {
  @IsOptional() @IsEmail() email?: string;
  @IsString() @Matches(/^(?:\d{6}|[A-Za-z0-9_-]{20,128})$/) token!: string;
}

export class ForgotPasswordDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) token!: string;
  @IsString() @MinLength(8) password!: string;
}

export class SelectTenantDto {
  @IsUUID() tenantId!: string;
}

export class AuthenticatedDeviceDto {
  @IsOptional() @IsString() @Matches(/^.{0,255}$/) deviceName?: string;
}
