-- Add the immutable, balance-neutral realization stage for posted ISSUE documents.
CREATE TYPE "IssueRealizationStatus" AS ENUM ('POSTED', 'CANCELLED');

CREATE TABLE "IssueRealization" (
    "id" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "displayNumber" SERIAL NOT NULL,
    "realizationDate" TIMESTAMP(3) NOT NULL,
    "recipientText" TEXT,
    "note" TEXT,
    "status" "IssueRealizationStatus" NOT NULL DEFAULT 'POSTED',
    "createdByUserId" UUID NOT NULL,
    "cancelledByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "IssueRealization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IssueRealizationLine" (
    "id" UUID NOT NULL,
    "realizationId" UUID NOT NULL,
    "issueLineId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueRealizationLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IssueRealizationLine_quantity_positive" CHECK ("quantity" > 0)
);

CREATE TABLE "IssueRealizationAttachment" (
    "id" UUID NOT NULL,
    "realizationId" UUID NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueRealizationAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssueRealization_displayNumber_key" ON "IssueRealization"("displayNumber");
CREATE INDEX "IssueRealization_issueId_idx" ON "IssueRealization"("issueId");
CREATE INDEX "IssueRealization_status_idx" ON "IssueRealization"("status");
CREATE INDEX "IssueRealization_realizationDate_idx" ON "IssueRealization"("realizationDate");
CREATE INDEX "IssueRealization_createdByUserId_idx" ON "IssueRealization"("createdByUserId");
CREATE INDEX "IssueRealization_cancelledByUserId_idx" ON "IssueRealization"("cancelledByUserId");

CREATE UNIQUE INDEX "IssueRealizationLine_realizationId_issueLineId_key" ON "IssueRealizationLine"("realizationId", "issueLineId");
CREATE INDEX "IssueRealizationLine_realizationId_idx" ON "IssueRealizationLine"("realizationId");
CREATE INDEX "IssueRealizationLine_issueLineId_idx" ON "IssueRealizationLine"("issueLineId");

CREATE UNIQUE INDEX "IssueRealizationAttachment_storedFileName_key" ON "IssueRealizationAttachment"("storedFileName");
CREATE INDEX "IssueRealizationAttachment_realizationId_idx" ON "IssueRealizationAttachment"("realizationId");
CREATE INDEX "IssueRealizationAttachment_uploadedByUserId_idx" ON "IssueRealizationAttachment"("uploadedByUserId");
CREATE INDEX "IssueRealizationAttachment_sha256_idx" ON "IssueRealizationAttachment"("sha256");

ALTER TABLE "IssueRealization" ADD CONSTRAINT "IssueRealization_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IssueRealization" ADD CONSTRAINT "IssueRealization_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IssueRealization" ADD CONSTRAINT "IssueRealization_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IssueRealizationLine" ADD CONSTRAINT "IssueRealizationLine_realizationId_fkey" FOREIGN KEY ("realizationId") REFERENCES "IssueRealization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueRealizationLine" ADD CONSTRAINT "IssueRealizationLine_issueLineId_fkey" FOREIGN KEY ("issueLineId") REFERENCES "StockDocumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IssueRealizationAttachment" ADD CONSTRAINT "IssueRealizationAttachment_realizationId_fkey" FOREIGN KEY ("realizationId") REFERENCES "IssueRealization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IssueRealizationAttachment" ADD CONSTRAINT "IssueRealizationAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
