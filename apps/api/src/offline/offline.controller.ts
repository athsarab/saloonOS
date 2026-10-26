import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { OfflineService } from './offline.service';
import { PrepareOfflineDto, RegisterOfflineDeviceDto, SyncCashDto } from './dto';
@Controller('offline')
@RequirePermissions(Permission.CHECKOUT)
export class OfflineController {
  constructor(private readonly offline: OfflineService) {}
  @Post('devices') @RequirePermissions(Permission.BUSINESS_SETTINGS_WRITE)
  register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterOfflineDeviceDto, @Headers('x-offline-device-secret') secret: string) { return this.offline.register(req.user, dto, secret); }
  @Get('devices') @RequirePermissions(Permission.BUSINESS_SETTINGS_WRITE)
  list(@Req() req: AuthenticatedRequest) { return this.offline.list(req.user); }
  @Post('devices/:id/revoke') @RequirePermissions(Permission.BUSINESS_SETTINGS_WRITE)
  revoke(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.offline.revoke(req.user, id); }
  @Post('prepare')
  prepare(@Req() req: AuthenticatedRequest, @Body() dto: PrepareOfflineDto, @Headers('x-offline-device-secret') secret: string) { return this.offline.prepare(req.user, dto, secret); }
  @Post('sync-cash')
  sync(@Req() req: AuthenticatedRequest, @Body() dto: SyncCashDto, @Headers('x-offline-device-secret') secret: string) { return this.offline.sync(req.user, dto, secret); }
}
