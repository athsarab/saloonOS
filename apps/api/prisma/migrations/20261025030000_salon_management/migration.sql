ALTER TABLE "CatalogItem" ADD COLUMN "category" VARCHAR(80);
ALTER TABLE "CatalogItem" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN "serviceId" UUID;

CREATE TABLE "StaffSchedule" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startsAt" VARCHAR(5) NOT NULL,
  "endsAt" VARCHAR(5) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffSchedule_tenantId_staffId_dayOfWeek_key" ON "StaffSchedule"("tenantId", "staffId", "dayOfWeek");
CREATE INDEX "StaffSchedule_tenantId_branchId_idx" ON "StaffSchedule"("tenantId", "branchId");
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_tenantId_staffId_fkey" FOREIGN KEY ("tenantId", "staffId") REFERENCES "StaffProfile"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StaffTimeOff" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "reason" VARCHAR(255),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffTimeOff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffTimeOff_tenantId_staffId_startsAt_endsAt_idx" ON "StaffTimeOff"("tenantId", "staffId", "startsAt", "endsAt");
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_tenantId_staffId_fkey" FOREIGN KEY ("tenantId", "staffId") REFERENCES "StaffProfile"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_serviceId_fkey" FOREIGN KEY ("tenantId", "serviceId") REFERENCES "CatalogItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Appointment_tenantId_staffProfileId_startsAt_endsAt_idx" ON "Appointment"("tenantId", "staffProfileId", "startsAt", "endsAt");
