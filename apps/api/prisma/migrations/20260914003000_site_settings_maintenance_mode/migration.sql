-- Site genelinde bakım modu (admin panelden yönetilir)
ALTER TABLE "SiteSettings" ADD COLUMN "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maintenanceMessage" TEXT;
