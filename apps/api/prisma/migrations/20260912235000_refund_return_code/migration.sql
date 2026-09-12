-- Yurtiçi Kargo RMA iade onay kodu alanları (saveReturnShipmentCode entegrasyonu)
-- AlterTable
ALTER TABLE "Refund" ADD COLUMN "returnCode" TEXT,
ADD COLUMN "returnCodeValidUntil" TIMESTAMP(3);
