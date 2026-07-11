# Bora Bilgic Teknik Store

React + Vite + React Router frontend, Express + Prisma + PostgreSQL backend ve paylasilan paketlerden olusan bagimsiz monorepo.

## Yapi

- `apps/web`: Musteri sitesi ve admin paneli
- `apps/api`: REST API, Prisma schema, seed
- `packages/ui`: Ortak tasarim tokenlari ve UI bilesenleri
- `packages/types`: Paylasilan tipler
- `packages/config`: Ortak uygulama ayarlari

## Kurulum

1. Root klasorde `npm install`
2. API icin `apps/api/.env` veya `.env.example` degerlerini kontrol et
3. Prisma client icin `npm run prisma:generate`
4. Veritabani hazirsa migration/seed:
   - `npm run prisma:migrate`
   - `npm run seed`
5. Ayrı terminallerde calistir:
   - `npm run dev:api`
   - `npm run dev:web`

## Demo Hesaplar

- Admin: `admin@borabilgicteknik.com` / `Password123!`
- Seed musteri: `musteri@borabilgicteknik.com` / `Password123!`
- Seed musteri: `ayse@borabilgicteknik.com` / `Password123!`
- Seed musteri: `can@borabilgicteknik.com` / `Password123!`
- Seed musteri: `selin@borabilgicteknik.com` / `Password123!`
- Seed musteri: `emre@borabilgicteknik.com` / `Password123!`

## Notlar

- Storefront yalnizca DJI urunlerini listeler.
- Kategori yapisi resmi DJI ailelerine gore sadeleştirildi: `Camera Drones`, `Handheld`, `Enterprise`.
- Bazi DJI enterprise ve premium urunleri `satisa kapali` baslar; detay sayfasinda teklif odakli gorunur.
- Admin panelinden urun bazinda satis ac/kapat yapilabilir, ancak marka sabit olarak DJI kabul edilir.
- Checkout gercek odeme almaz, siparis kaydi olusturur.
- Seed sonrasinda:
  - birden fazla siparis durumu (`pending`, `processing`, `shipped`, `delivered`) gorunur
  - admin dashboard sifir olmayan satis ve stok metrikleri gosterir
  - bazi musteriler dolu sepet ve siparis gecmisi ile gelir
  - katalog ve admin ekranlari sadece DJI urun ailelerini gosterir

## Deployment

- Frontend production yayininda servis edilmesi gereken klasor: `apps/web/dist`
- Frontend build komutu: `npm run build:web`
- Render kullaniliyorsa kokteki `render.yaml` dosyasi static site'i dogrudan `apps/web/dist` klasorunden yayinlayacak sekilde hazirlandi.
- Production ortaminda `src/main.tsx`, `src/**/*.tsx` veya Vite dev server ciktilari servis edilmemelidir. Aksi halde `$RefreshSig$ is not defined` benzeri Fast Refresh hatalari gorulebilir.
