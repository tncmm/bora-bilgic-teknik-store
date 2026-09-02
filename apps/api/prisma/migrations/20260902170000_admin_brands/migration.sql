CREATE TABLE IF NOT EXISTS "Brand" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Brand_name_key" ON "Brand"("name");

INSERT INTO "Brand" ("id", "name", "updatedAt")
SELECT 'brand_' || md5("brand"), "brand", CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "brand"
  FROM "Product"
  WHERE trim("brand") <> ''
) existing_brands
ON CONFLICT ("name") DO NOTHING;
