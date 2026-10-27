import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PosService } from './pos.service';
import { CheckoutService } from './checkout.service';
import { BranchPriceDto, PosCustomerDto, StockAdjustmentDto, StockPolicyDto, VoidDto } from './pos.dto';
import { VerifyTransferDto } from './dto';

@Controller('pos')
export class PosController {
  constructor(private readonly pos: PosService, private readonly checkout: CheckoutService) {}
  @Get('branches') @RequirePermissions(Permission.CHECKOUT)
  branches(@Req() r: AuthenticatedRequest) { return this.pos.branches(r.user.tenantId, r.user.sub); }
  @Get('catalog') @RequirePermissions(Permission.CHECKOUT)
  catalog(@Req() r: AuthenticatedRequest, @Query('branchId') branchId: string) { return this.pos.catalog(r.user.tenantId, r.user.sub, branchId); }
  @Get('categories') @RequirePermissions(Permission.SERVICES_READ)
  categories(@Req() r: AuthenticatedRequest) { return this.pos.categories(r.user.tenantId); }
  @Post('branches/:branchId/prices/:itemId') @RequirePermissions(Permission.SERVICES_WRITE)
  price(@Req() r: AuthenticatedRequest, @Param('branchId') branchId: string, @Param('itemId') itemId: string, @Body() dto: BranchPriceDto) { return this.pos.price(r.user.tenantId, r.user.sub, branchId, itemId, dto); }
  @Post('branches/:id/stock-policy') @RequirePermissions(Permission.BUSINESS_SETTINGS_WRITE)
  policy(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: StockPolicyDto) { return this.pos.policy(r.user.tenantId, r.user.sub, id, dto.policy); }
  @Post('customers') @RequirePermissions(Permission.CUSTOMER_WRITE)
  customer(@Req() r: AuthenticatedRequest, @Body() dto: PosCustomerDto) { return this.pos.customer(r.user.tenantId, r.user.sub, dto); }
  @Get('inventory') @RequirePermissions(Permission.INVENTORY_READ)
  inventory(@Req() r: AuthenticatedRequest, @Query('branchId') branchId: string) { return this.pos.inventory(r.user.tenantId, r.user.sub, branchId); }
  @Post('inventory/adjust') @RequirePermissions(Permission.INVENTORY_WRITE)
  adjust(@Req() r: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() dto: StockAdjustmentDto) { return this.pos.adjust(r.user.tenantId, r.user.sub, key, dto); }
  @Post('sales/:id/void') @RequirePermissions(Permission.VOIDS)
  void(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Headers('idempotency-key') key: string, @Body() dto: VoidDto) { return this.pos.void(r.user.tenantId, r.user.sub, id, key, dto); }
  @Post('payments/:id/resolve') @RequirePermissions(Permission.PAYMENTS_VERIFY)
  resolve(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Headers('idempotency-key') key: string, @Body() dto: VerifyTransferDto) { return this.checkout.verifyTransfer(r.user.tenantId, r.user.sub, id, dto, key ?? ''); }
  @Get('audit') @RequirePermissions(Permission.REPORTS_READ)
  audit(@Req() r: AuthenticatedRequest) { return this.pos.auditLogs(r.user.tenantId); }
}
