ALTER TABLE "Refund"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS "requestedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedByEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "customerReason" TEXT,
  ADD COLUMN IF NOT EXISTS "customerNote" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "RefundItem" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "lineTotal" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RefundItem_refundId_fkey'
  ) THEN
    ALTER TABLE "RefundItem"
      ADD CONSTRAINT "RefundItem_refundId_fkey"
      FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RefundItem_orderItemId_fkey'
  ) THEN
    ALTER TABLE "RefundItem"
      ADD CONSTRAINT "RefundItem_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RefundItem_refundId_idx" ON "RefundItem"("refundId");
CREATE INDEX IF NOT EXISTS "RefundItem_orderItemId_idx" ON "RefundItem"("orderItemId");
