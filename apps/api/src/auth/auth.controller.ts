import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, SelectTenantDto, TokenDto, VerifyEmailDto } from './dto';
import { Public } from './auth.decorators';
import { AuthenticatedRequest } from './auth.types';

@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Public() @Post('verify-email') verifyEmail(@Body() dto: VerifyEmailDto) { return this.auth.verifyEmail(dto); }
  @Public() @Post('login') login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) { return this.auth.login(dto, { userAgent }); }
  @Public() @Post('refresh') refresh(@Body() dto: TokenDto, @Headers('user-agent') userAgent?: string) { return this.auth.refresh(dto, { userAgent }); }
  @Public() @Post('forgot-password') forgotPassword(@Body() dto: ForgotPasswordDto) { return this.auth.forgotPassword(dto); }
  @Public() @Post('reset-password') resetPassword(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto); }
  @Post('logout') logout(@Req() req: AuthenticatedRequest) { return this.auth.logout(req.user); }
  @Post('logout-all') logoutAll(@Req() req: AuthenticatedRequest) { return this.auth.logoutAll(req.user); }
  @Post('select-tenant') selectTenant(@Req() req: AuthenticatedRequest, @Body() dto: SelectTenantDto) { return this.auth.selectTenant(req.user, dto); }
}
