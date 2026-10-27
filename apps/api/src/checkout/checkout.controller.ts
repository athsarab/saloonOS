import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '../auth/auth.constants';
import { RequirePermissions } from '../auth/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CheckoutService } from './checkout.service';
import { CatalogDto, CheckoutDto, CloseShiftDto, OpenShiftDto, RefundDto, SalesQueryDto, VerifyTransferDto } from './dto';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get('access') @RequirePermissions(Permission.CHECKOUT)
  access(@Req() req: AuthenticatedRequest) { return this.checkout.access(req.user.tenantId, req.user.sub); }

  @Post('catalog') @RequirePermissions(Permission.INVENTORY_WRITE)
  createCatalog(@Req() req: AuthenticatedRequest, @Body() dto: CatalogDto) { return this.checkout.createCatalog(req.user.tenantId, req.user.sub, dto); }

  @Post('quote') @RequirePermissions(Permission.CHECKOUT)
  quote(@Req() req: AuthenticatedRequest, @Body() dto: CheckoutDto) { return this.checkout.quote(req.user.tenantId, req.user.sub, dto); }

  @Get('sales/:id/receipt') @RequirePermissions(Permission.CHECKOUT)
  receipt(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.checkout.receipt(req.user.tenantId, id, req.user.sub); }

  @Get('catalog')
  @RequirePermissions(Permission.SERVICES_READ)
  catalog(@Req() req: AuthenticatedRequest, @Query('search') search?: string) { return this.checkout.catalog(req.user.tenantId, search); }

  @Get('customers')
  @RequirePermissions(Permission.CUSTOMER_READ)
  customers(@Req() req: AuthenticatedRequest, @Query('search') search?: string) { return this.checkout.customers(req.user.tenantId, search); }

  @Get('staff')
  @RequirePermissions(Permission.CHECKOUT)
  staff(@Req() req: AuthenticatedRequest, @Query('branchId') branchId: string) { return this.checkout.staff(req.user.tenantId, branchId, req.user.sub); }

  @Post('sales')
  @RequirePermissions(Permission.CHECKOUT)
  salesCreate(@Req() req: AuthenticatedRequest, @Headers('idempotency-key') idempotencyKey: string, @Body() dto: CheckoutDto) { return this.checkout.checkout(req.user.tenantId, req.user.sub, idempotencyKey, dto); }

  @Get('sales')
  @RequirePermissions(Permission.CHECKOUT)
  sales(@Req() req: AuthenticatedRequest, @Query() query: SalesQueryDto) { return this.checkout.sales(req.user.tenantId, query, req.user.sub); }

  @Post('sales/:id/refunds')
  @RequirePermissions(Permission.REFUNDS)
  refund(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Headers('idempotency-key') key: string, @Body() dto: RefundDto) { return this.checkout.refund(req.user.tenantId, req.user.sub, id, dto, key); }

  @Post('payments/:id/verify-transfer')
  @RequirePermissions(Permission.REFUNDS)
  verifyTransfer(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: VerifyTransferDto) { return this.checkout.verifyTransfer(req.user.tenantId, req.user.sub, id, dto); }

  @Get('report/daily')
  @RequirePermissions(Permission.REPORTS_READ)
  report(@Req() req: AuthenticatedRequest, @Query() query: SalesQueryDto) { return this.checkout.report(req.user.tenantId, query, req.user.sub); }

  @Get('shifts/current')
  @RequirePermissions(Permission.CHECKOUT)
  currentShift(@Req() req: AuthenticatedRequest, @Query('branchId') branchId: string) { return this.checkout.currentShift(req.user.tenantId, branchId, req.user.sub); }

  @Post('shifts')
  @RequirePermissions(Permission.CHECKOUT)
  openShift(@Req() req: AuthenticatedRequest, @Body() dto: OpenShiftDto) { return this.checkout.openShift(req.user.tenantId, req.user.sub, dto); }

  @Post('shifts/:id/close')
  @RequirePermissions(Permission.CHECKOUT)
  closeShift(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CloseShiftDto) { return this.checkout.closeShift(req.user.tenantId, req.user.sub, id, dto); }
}
