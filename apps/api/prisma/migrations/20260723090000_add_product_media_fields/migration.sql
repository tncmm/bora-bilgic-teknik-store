ALTER TABLE "ProductImage"
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'image',
ADD COLUMN "thumbnailUrl" TEXT,
ADD COLUMN "mimeType" TEXT;
