-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "merchantOid" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TL',
    "shippingName" TEXT NOT NULL,
    "shippingPhone" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingDistrict" TEXT NOT NULL,
    "shippingAddressLine" TEXT NOT NULL,
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_merchantOid_key" ON "PaymentAttempt"("merchantOid");

-- CreateIndex
CREATE INDEX "PaymentAttempt_userId_status_idx" ON "PaymentAttempt"("userId", "status");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
