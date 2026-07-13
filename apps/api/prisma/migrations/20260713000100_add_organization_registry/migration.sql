CREATE TABLE "Management" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Management_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "managementId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serviceId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResponsiblePerson" (
    "id" UUID NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "personnelNumber" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "managementId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "unitId" UUID,
    "appointmentOrderNumber" TEXT,
    "appointmentDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponsiblePerson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Management_code_key" ON "Management"("code");
CREATE INDEX "Management_isActive_idx" ON "Management"("isActive");

CREATE UNIQUE INDEX "Service_managementId_code_key" ON "Service"("managementId", "code");
CREATE INDEX "Service_managementId_idx" ON "Service"("managementId");
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

CREATE UNIQUE INDEX "Unit_serviceId_code_key" ON "Unit"("serviceId", "code");
CREATE INDEX "Unit_serviceId_idx" ON "Unit"("serviceId");
CREATE INDEX "Unit_isActive_idx" ON "Unit"("isActive");

CREATE UNIQUE INDEX "ResponsiblePerson_personnelNumber_key" ON "ResponsiblePerson"("personnelNumber");
CREATE INDEX "ResponsiblePerson_managementId_idx" ON "ResponsiblePerson"("managementId");
CREATE INDEX "ResponsiblePerson_serviceId_idx" ON "ResponsiblePerson"("serviceId");
CREATE INDEX "ResponsiblePerson_unitId_idx" ON "ResponsiblePerson"("unitId");
CREATE INDEX "ResponsiblePerson_isActive_idx" ON "ResponsiblePerson"("isActive");
CREATE INDEX "ResponsiblePerson_lastName_idx" ON "ResponsiblePerson"("lastName");
CREATE INDEX "ResponsiblePerson_firstName_idx" ON "ResponsiblePerson"("firstName");
CREATE INDEX "ResponsiblePerson_middleName_idx" ON "ResponsiblePerson"("middleName");
CREATE INDEX "ResponsiblePerson_personnelNumber_idx" ON "ResponsiblePerson"("personnelNumber");

ALTER TABLE "Service" ADD CONSTRAINT "Service_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResponsiblePerson" ADD CONSTRAINT "ResponsiblePerson_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResponsiblePerson" ADD CONSTRAINT "ResponsiblePerson_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResponsiblePerson" ADD CONSTRAINT "ResponsiblePerson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
