import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, CatalogItemType, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AppointmentDto, AppointmentQueryDto, BranchDto, CreateStaffMemberDto, CustomerDto, CustomerQueryDto, ScheduleDto, ServiceDto, StaffDto, TimeOffDto, UpdateAppointmentDto, UpdateBusinessDto } from './dto';

const activeStatuses = { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] };

@Injectable()
export class SalonService {
  constructor(private readonly db: DatabaseService) {}

  async profile(tenantId: string) {
    return this.db.tenant.findUnique({ where: { id: tenantId }, include: { branches: true } });
  }

  async updateProfile(tenantId: string, dto: UpdateBusinessDto) {
    return this.db.tenant.update({ where: { id: tenantId }, data: dto });
  }

  async branches(tenantId: string) {
    return this.db.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async createBranch(tenantId: string, dto: BranchDto) {
    return this.db.branch.create({ data: { tenantId, ...dto } });
  }

  async services(tenantId: string, query: CustomerQueryDto) {
    const where: Prisma.CatalogItemWhereInput = { tenantId, type: CatalogItemType.SERVICE, ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}) };
    const [items, total] = await this.db.$transaction([this.db.catalogItem.findMany({ where, orderBy: { name: 'asc' }, skip: query.offset, take: query.limit }), this.db.catalogItem.count({ where })]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  async createService(tenantId: string, dto: ServiceDto) {
    return this.db.catalogItem.create({ data: { tenantId, name: dto.name, category: dto.category, description: dto.description, type: CatalogItemType.SERVICE, priceLkr: dto.priceLkr, durationMinutes: dto.durationMinutes } });
  }

  async updateService(tenantId: string, id: string, dto: Partial<ServiceDto>) {
    const result = await this.db.catalogItem.updateMany({ where: { id, tenantId, type: CatalogItemType.SERVICE }, data: dto });
    if (!result.count) throw new NotFoundException('Service not found');
    return this.db.catalogItem.findFirstOrThrow({ where: { id, tenantId } });
  }

  async customers(tenantId: string, query: CustomerQueryDto) {
    const where: Prisma.CustomerWhereInput = { tenantId, ...(query.search ? { OR: [{ firstName: { contains: query.search, mode: 'insensitive' } }, { lastName: { contains: query.search, mode: 'insensitive' } }, { phone: { contains: query.search } }] } : {}) };
    const [items, total] = await this.db.$transaction([this.db.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: query.offset, take: query.limit }), this.db.customer.count({ where })]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  async createCustomer(tenantId: string, dto: CustomerDto) {
    return this.db.customer.create({ data: { tenantId, ...dto } });
  }

  async customer(tenantId: string, id: string) {
    const customer = await this.db.customer.findFirst({ where: { id, tenantId }, include: { appointments: { orderBy: { startsAt: 'desc' }, take: 50, include: { service: true, staffProfile: { include: { user: { select: { displayName: true } } } } } } } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async staff(tenantId: string) {
    return this.db.staffProfile.findMany({ where: { tenantId }, include: { user: { select: { id: true, displayName: true, email: true } }, branch: true, schedules: true, timeOff: { orderBy: { startsAt: 'asc' }, take: 20 } }, orderBy: { createdAt: 'asc' } });
  }

  async createStaff(tenantId: string, dto: StaffDto) {
    const membership = await this.db.membership.findUnique({ where: { tenantId_userId: { tenantId, userId: dto.userId } } });
    if (!membership) throw new ForbiddenException('Staff user is not a member of this business');
    return this.db.staffProfile.create({ data: { tenantId, userId: dto.userId, branchId: dto.branchId, title: dto.title } });
  }

  async createStaffMember(tenantId: string, dto: CreateStaffMemberDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('A user with this email already exists');
    const branch = await this.db.branch.findFirst({ where: { id: dto.branchId, tenantId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, displayName: dto.displayName.trim(), passwordHash, emailVerifiedAt: new Date() } });
      await tx.membership.create({ data: { tenantId, userId: user.id, role: dto.role } });
      return tx.staffProfile.create({ data: { tenantId, userId: user.id, branchId: dto.branchId, title: dto.title?.trim() || null }, include: { user: { select: { id: true, displayName: true, email: true } }, branch: true } });
    });
  }

  async schedule(tenantId: string, staffId: string, dto: ScheduleDto) {
    await this.assertStaff(tenantId, staffId, dto.branchId);
    if (dto.startsAt >= dto.endsAt) throw new ConflictException('Schedule end must be after start');
    return this.db.staffSchedule.upsert({ where: { tenantId_staffId_dayOfWeek: { tenantId, staffId, dayOfWeek: dto.dayOfWeek } }, create: { tenantId, staffId, ...dto }, update: { branchId: dto.branchId, startsAt: dto.startsAt, endsAt: dto.endsAt } });
  }

  async timeOff(tenantId: string, staffId: string, dto: TimeOffDto) {
    await this.assertStaff(tenantId, staffId, dto.branchId);
    const startsAt = new Date(dto.startsAt); const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) throw new ConflictException('Time off end must be after start');
    return this.db.staffTimeOff.create({ data: { tenantId, staffId, branchId: dto.branchId, startsAt, endsAt, reason: dto.reason } });
  }

  async appointments(tenantId: string, query: AppointmentQueryDto) {
    const where: Prisma.AppointmentWhereInput = { tenantId, startsAt: { gte: new Date(query.from), lt: new Date(query.to) }, ...(query.staffProfileId ? { staffProfileId: query.staffProfileId } : {}), ...(query.status ? { status: query.status } : {}) };
    const [items, total] = await this.db.$transaction([this.db.appointment.findMany({ where, include: { customer: true, service: true, staffProfile: { include: { user: { select: { displayName: true } } } }, branch: true }, orderBy: { startsAt: 'asc' }, skip: query.offset, take: query.limit }), this.db.appointment.count({ where })]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  async appointment(tenantId: string, id: string) {
    const item = await this.db.appointment.findFirst({ where: { id, tenantId }, include: { customer: true, service: true, staffProfile: { include: { user: { select: { displayName: true } } } }, branch: true } });
    if (!item) throw new NotFoundException('Appointment not found');
    return item;
  }

  async createAppointment(tenantId: string, dto: AppointmentDto) {
    const service = await this.db.catalogItem.findFirst({ where: { id: dto.serviceId, tenantId, type: CatalogItemType.SERVICE, active: true } });
    if (!service?.durationMinutes) throw new ConflictException('Service is unavailable or has no duration');
    const startsAt = new Date(dto.startsAt); const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60000);
    if (startsAt <= new Date()) throw new ConflictException('Appointment must be in the future');
    await this.assertReferences(tenantId, dto.branchId, dto.customerId, dto.staffProfileId);
    return this.db.$transaction(async (tx) => {
      if (dto.staffProfileId) await this.assertNoConflict(tx, tenantId, dto.staffProfileId, startsAt, endsAt);
      return tx.appointment.create({ data: { tenantId, branchId: dto.branchId, customerId: dto.customerId, serviceId: dto.serviceId, staffProfileId: dto.staffProfileId, startsAt, endsAt, notes: dto.notes }, include: { customer: true, service: true, staffProfile: { include: { user: { select: { displayName: true } } } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateAppointment(tenantId: string, id: string, dto: UpdateAppointmentDto) {
    const current = await this.db.appointment.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Appointment not found');
    if (dto.status === AppointmentStatus.CANCELLED || dto.status === AppointmentStatus.NO_SHOW) return this.db.appointment.update({ where: { id }, data: { status: dto.status } });
    const serviceId = dto.serviceId ?? current.serviceId;
    if (!serviceId) throw new ConflictException('Appointment requires a service');
    const service = await this.db.catalogItem.findFirst({ where: { id: serviceId, tenantId, type: CatalogItemType.SERVICE, active: true } });
    if (!service?.durationMinutes) throw new ConflictException('Service is unavailable or has no duration');
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt; const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60000); const staffId = dto.staffProfileId === undefined ? current.staffProfileId : dto.staffProfileId;
    await this.assertReferences(tenantId, dto.branchId ?? current.branchId, dto.customerId ?? current.customerId, staffId);
    return this.db.$transaction(async (tx) => { if (staffId) await this.assertNoConflict(tx, tenantId, staffId, startsAt, endsAt, id); return tx.appointment.update({ where: { id }, data: { ...dto, serviceId, startsAt, endsAt, branchId: dto.branchId ?? current.branchId, customerId: dto.customerId ?? current.customerId, staffProfileId: staffId }, include: { customer: true, service: true, staffProfile: { include: { user: { select: { displayName: true } } } } } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async dashboard(tenantId: string, from: string, to: string) {
    const where = { tenantId, startsAt: { gte: new Date(from), lt: new Date(to) } };
    const [total, completed, cancelled, upcoming] = await Promise.all([this.db.appointment.count({ where }), this.db.appointment.count({ where: { ...where, status: AppointmentStatus.COMPLETED } }), this.db.appointment.count({ where: { ...where, status: AppointmentStatus.CANCELLED } }), this.db.appointment.count({ where: { ...where, status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CONFIRMED] } } })]);
    return { total, completed, cancelled, upcoming };
  }

  private async assertStaff(tenantId: string, staffId: string, branchId: string) { const staff = await this.db.staffProfile.findFirst({ where: { id: staffId, tenantId, branchId, active: true } }); if (!staff) throw new NotFoundException('Staff profile not found'); }
  private async assertReferences(tenantId: string, branchId: string, customerId: string, staffId?: string | null) { if (!(await this.db.branch.findFirst({ where: { id: branchId, tenantId } }))) throw new NotFoundException('Branch not found'); if (!(await this.db.customer.findFirst({ where: { id: customerId, tenantId } }))) throw new NotFoundException('Customer not found'); if (staffId) await this.assertStaff(tenantId, staffId, branchId); }
  private async assertNoConflict(tx: Prisma.TransactionClient, tenantId: string, staffId: string, startsAt: Date, endsAt: Date, excludeId?: string) { const conflict = await tx.appointment.findFirst({ where: { tenantId, staffProfileId: staffId, status: activeStatuses, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(excludeId ? { id: { not: excludeId } } : {}) } }); if (conflict) throw new ConflictException('Stylist already has an appointment in this time range'); const timeOff = await tx.staffTimeOff.findFirst({ where: { tenantId, staffId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }); if (timeOff) throw new ConflictException('Stylist is unavailable during this time'); }
}
