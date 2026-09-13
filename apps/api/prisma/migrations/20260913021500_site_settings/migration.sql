-- Site geneli iletişim ayarları (singleton, id='main')
-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "contactHeroTitle" TEXT,
    "contactHeroDescription" TEXT,
    "contactAddress" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contactWhatsapp" TEXT,
    "contactMapUrl" TEXT,
    "contactHoursDays" TEXT,
    "contactHoursTime" TEXT,
    "contactRemoteNote" TEXT,
    "contactCorporateNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
