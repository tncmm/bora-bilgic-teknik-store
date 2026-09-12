-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cargoBarcode" TEXT,
ADD COLUMN     "cargoCompany" TEXT DEFAULT 'Yurtiçi Kargo',
ADD COLUMN     "cargoEvents" JSONB,
ADD COLUMN     "cargoLastEvent" TEXT,
ADD COLUMN     "cargoLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "cargoStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_cargoBarcode_key" ON "Order"("cargoBarcode");
