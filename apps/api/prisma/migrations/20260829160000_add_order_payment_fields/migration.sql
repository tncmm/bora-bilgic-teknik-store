-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentAmount" DECIMAL(10,2),
ADD COLUMN     "paymentCurrency" TEXT,
ADD COLUMN     "paymentFailureCode" TEXT,
ADD COLUMN     "paymentFailureMessage" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "paymentType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentRef_key" ON "Order"("paymentRef");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Order_userId_paymentStatus_idx" ON "Order"("userId", "paymentStatus");
