-- Guest checkout, billing identity storage and PayTR refund support.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "trackingTokenHash" TEXT,
  ADD COLUMN "trackingTokenEncrypted" TEXT,
  ADD COLUMN "billingType" TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN "billingName" TEXT,
  ADD COLUMN "billingPhone" TEXT,
  ADD COLUMN "billingCity" TEXT,
  ADD COLUMN "billingDistrict" TEXT,
  ADD COLUMN "billingAddressLine" TEXT,
  ADD COLUMN "companyName" TEXT,
  ADD COLUMN "taxOffice" TEXT,
  ADD COLUMN "taxNumber" TEXT,
  ADD COLUMN "identityNumberEncrypted" TEXT,
  ADD COLUMN "identityNumberLast4" TEXT;

UPDATE "PaymentAttempt"
SET
  "customerEmail" = COALESCE((SELECT "email" FROM "User" WHERE "User"."id" = "PaymentAttempt"."userId"), 'guest@borabilgic.net.tr'),
  "billingName" = "shippingName",
  "billingPhone" = "shippingPhone",
  "billingCity" = "shippingCity",
  "billingDistrict" = "shippingDistrict",
  "billingAddressLine" = "shippingAddressLine",
  "identityNumberEncrypted" = 'legacy-unavailable',
  "identityNumberLast4" = '0000'
WHERE "customerEmail" IS NULL;

ALTER TABLE "PaymentAttempt"
  ALTER COLUMN "customerEmail" SET NOT NULL,
  ALTER COLUMN "billingName" SET NOT NULL,
  ALTER COLUMN "billingPhone" SET NOT NULL,
  ALTER COLUMN "billingCity" SET NOT NULL,
  ALTER COLUMN "billingDistrict" SET NOT NULL,
  ALTER COLUMN "billingAddressLine" SET NOT NULL,
  ALTER COLUMN "identityNumberEncrypted" SET NOT NULL,
  ALTER COLUMN "identityNumberLast4" SET NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;

CREATE UNIQUE INDEX "PaymentAttempt_trackingTokenHash_key" ON "PaymentAttempt"("trackingTokenHash");
CREATE INDEX "PaymentAttempt_customerEmail_createdAt_idx" ON "PaymentAttempt"("customerEmail", "createdAt");

ALTER TABLE "Order"
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "trackingTokenHash" TEXT,
  ADD COLUMN "trackingTokenEncrypted" TEXT,
  ADD COLUMN "billingType" TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN "billingName" TEXT,
  ADD COLUMN "billingPhone" TEXT,
  ADD COLUMN "billingCity" TEXT,
  ADD COLUMN "billingDistrict" TEXT,
  ADD COLUMN "billingAddressLine" TEXT,
  ADD COLUMN "companyName" TEXT,
  ADD COLUMN "taxOffice" TEXT,
  ADD COLUMN "taxNumber" TEXT,
  ADD COLUMN "identityNumberEncrypted" TEXT,
  ADD COLUMN "identityNumberLast4" TEXT,
  ADD COLUMN "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "lastRefundedAt" TIMESTAMP(3),
  ADD COLUMN "invoicePdfUrl" TEXT,
  ADD COLUMN "invoiceFileName" TEXT,
  ADD COLUMN "invoiceUploadedAt" TIMESTAMP(3),
  ADD COLUMN "invoiceSentAt" TIMESTAMP(3);

UPDATE "Order"
SET
  "customerEmail" = COALESCE((SELECT "email" FROM "User" WHERE "User"."id" = "Order"."userId"), 'guest@borabilgic.net.tr'),
  "billingName" = "shippingName",
  "billingPhone" = "shippingPhone",
  "billingCity" = "shippingCity",
  "billingDistrict" = "shippingDistrict",
  "billingAddressLine" = "shippingAddressLine",
  "identityNumberEncrypted" = 'legacy-unavailable',
  "identityNumberLast4" = '0000'
WHERE "customerEmail" IS NULL;

ALTER TABLE "Order"
  ALTER COLUMN "customerEmail" SET NOT NULL,
  ALTER COLUMN "billingName" SET NOT NULL,
  ALTER COLUMN "billingPhone" SET NOT NULL,
  ALTER COLUMN "billingCity" SET NOT NULL,
  ALTER COLUMN "billingDistrict" SET NOT NULL,
  ALTER COLUMN "billingAddressLine" SET NOT NULL,
  ALTER COLUMN "identityNumberEncrypted" SET NOT NULL,
  ALTER COLUMN "identityNumberLast4" SET NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;

CREATE UNIQUE INDEX "Order_trackingTokenHash_key" ON "Order"("trackingTokenHash");
CREATE INDEX "Order_customerEmail_createdAt_idx" ON "Order"("customerEmail", "createdAt");

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "adminId" TEXT,
  "merchantOid" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "AttemptStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "restock" BOOLEAN NOT NULL DEFAULT false,
  "paytrReference" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");
