import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '../auth/auth.constants';
import { RequirePermissions } from '../auth/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AppointmentDto, AppointmentQueryDto, BranchDto, CreateStaffMemberDto, CustomerDto, CustomerQueryDto, DashboardQueryDto, ScheduleDto, ServiceDto, StaffDto, TimeOffDto, UpdateAppointmentDto, UpdateBusinessDto } from './dto';
import { SalonService } from './salon.service';

@ApiTags('salon')
@Controller('salon')
export class SalonController {
  constructor(private readonly salon: SalonService) {}
  @Get('dashboard') @RequirePermissions(Permission.APPOINTMENTS_READ) dashboard(@Req() req: AuthenticatedRequest, @Query() query: DashboardQueryDto) { return this.salon.dashboard(req.user.tenantId, req.user.sub, req.user.role, query.from, query.to); }
  @Get('profile') @RequirePermissions(Permission.BUSINESS_SETTINGS_READ) profile(@Req() req: AuthenticatedRequest) { return this.salon.profile(req.user.tenantId); }
  @Patch('profile') @RequirePermissions(Permission.BUSINESS_SETTINGS_WRITE) updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateBusinessDto) { return this.salon.updateProfile(req.user.tenantId, dto); }
  @Get('branches') @RequirePermissions(Permission.BUSINESS_SETTINGS_READ) branches(@Req() req: AuthenticatedRequest) { return this.salon.branches(req.user.tenantId); }
  @Post('branches') @RequirePermissions(Permission.BUSINESS_SETTINGS_WRITE) createBranch(@Req() req: AuthenticatedRequest, @Body() dto: BranchDto) { return this.salon.createBranch(req.user.tenantId, dto); }
  @Get('services') @RequirePermissions(Permission.SERVICES_READ) services(@Req() req: AuthenticatedRequest, @Query() query: CustomerQueryDto) { return this.salon.services(req.user.tenantId, query); }
  @Post('services') @RequirePermissions(Permission.SERVICES_WRITE) createService(@Req() req: AuthenticatedRequest, @Body() dto: ServiceDto) { return this.salon.createService(req.user.tenantId, dto); }
  @Patch('services/:id') @RequirePermissions(Permission.SERVICES_WRITE) updateService(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: Partial<ServiceDto>) { return this.salon.updateService(req.user.tenantId, id, dto); }
  @Get('customers') @RequirePermissions(Permission.CUSTOMER_READ) customers(@Req() req: AuthenticatedRequest, @Query() query: CustomerQueryDto) { return this.salon.customers(req.user.tenantId, query); }
  @Post('customers') @RequirePermissions(Permission.CUSTOMER_WRITE) createCustomer(@Req() req: AuthenticatedRequest, @Body() dto: CustomerDto) { return this.salon.createCustomer(req.user.tenantId, dto); }
  @Get('customers/:id') @RequirePermissions(Permission.CUSTOMER_READ) customer(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.salon.customer(req.user.tenantId, id); }
  @Get('staff') @RequirePermissions(Permission.STAFF_READ) staff(@Req() req: AuthenticatedRequest) { return this.salon.staff(req.user.tenantId); }
  @Get('staff/me/jobs') @RequirePermissions(Permission.APPOINTMENTS_READ) myJobs(@Req() req: AuthenticatedRequest) { return this.salon.jobs(req.user.tenantId, req.user.sub); }
  @Get('staff/:id/jobs') @RequirePermissions(Permission.STAFF_READ) memberJobs(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.salon.jobs(req.user.tenantId, undefined, id); }
  @Post('staff/members') @RequirePermissions(Permission.STAFF_WRITE) createStaffMember(@Req() req: AuthenticatedRequest, @Body() dto: CreateStaffMemberDto) { return this.salon.createStaffMember(req.user.tenantId, dto); }
  @Post('staff') @RequirePermissions(Permission.STAFF_WRITE) createStaff(@Req() req: AuthenticatedRequest, @Body() dto: StaffDto) { return this.salon.createStaff(req.user.tenantId, dto); }
  @Post('staff/:id/schedule') @RequirePermissions(Permission.STAFF_SCHEDULE_WRITE) schedule(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ScheduleDto) { return this.salon.schedule(req.user.tenantId, id, dto); }
  @Post('staff/:id/time-off') @RequirePermissions(Permission.STAFF_SCHEDULE_WRITE) timeOff(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: TimeOffDto) { return this.salon.timeOff(req.user.tenantId, id, dto); }
  @Get('appointments') @RequirePermissions(Permission.APPOINTMENTS_READ) appointments(@Req() req: AuthenticatedRequest, @Query() query: AppointmentQueryDto) { return this.salon.appointments(req.user.tenantId, query, req.user.sub, req.user.role); }
  @Get('appointments/:id') @RequirePermissions(Permission.APPOINTMENTS_READ) appointment(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.salon.appointment(req.user.tenantId, id, req.user.sub, req.user.role); }
  @Post('appointments') @RequirePermissions(Permission.APPOINTMENTS_WRITE) createAppointment(@Req() req: AuthenticatedRequest, @Body() dto: AppointmentDto) { return this.salon.createAppointment(req.user.tenantId, dto, req.user.sub, req.user.role); }
  @Patch('appointments/:id') @RequirePermissions(Permission.APPOINTMENTS_WRITE) updateAppointment(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) { return this.salon.updateAppointment(req.user.tenantId, id, dto, req.user.sub, req.user.role); }
}
