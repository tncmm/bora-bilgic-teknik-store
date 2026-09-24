ALTER TABLE "Order" ADD COLUMN "cargoCreatedAt" TIMESTAMP(3);

UPDATE "Order"
SET "cargoCreatedAt" = COALESCE("cargoLastSyncedAt", "updatedAt", "createdAt")
WHERE "cargoBarcode" IS NOT NULL
  AND "cargoCreatedAt" IS NULL;
