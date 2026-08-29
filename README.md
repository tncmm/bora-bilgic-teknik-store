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
- Checkout PayTR iFrame ile gercek odeme alir; siparis ancak odeme PayTR tarafindan onaylandiktan sonra olusur. PayTR anahtarlari tanimli degilse odeme adimi 503 ile net bir sekilde reddedilir (siparis olusmaz).

## Odeme (PayTR iFrame)

Akis (odeme-oncelikli): musteri checkout'ta `POST /api/v1/payments/paytr/checkout` cagirir; API stogu atomik olarak rezerve eden bir `PaymentAttempt` olusturur ve PayTR iframe tokeni dondurur. Musteri karti PayTR guvenli cercevesinde girer — kart verisi magaza sunucusuna hic ulasmaz. Siparis kaydi (`Order`) yalnizca callback "success" geldiginde yaratilir; basarisiz/suresi dolan denemeler stoklarini iade eder ve sepet korunur.

- **Callback:** PayTR odeme sonucunu `POST /api/v1/payments/paytr/callback` adresine sunucu-sunucu bildirir. Endpoint HMAC imzasini dogrular, tutari deneme toplamiyla karsilastirir, sonra siparisi tek transaction icinde olusturur (attempt COMPLETED + sepet temizlenir). Basarisiz bildirimde attempt FAILED olur ve stok iade edilir.
- **Idempotency:** PayTR "OK" disinda yanit alirsa callback'i tekrarlar; tum gecisler `PENDING` korumali oldugu icin tekrarlar guvenlidir. Basari/hata sayfalari `WEB_URL` altindaki `/odeme/basarili` ve `/odeme/basarisiz` yollaridir.
- **Odeme penceresi:** Her deneme icin benzersiz, alfanumerik `merchant_oid` uretilir. 30 dakika icinde tamamlanmayan denemeler kullanicinin bir sonraki checkout'unda suresi dolmus sayilip stoklari iade edilir; yeni checkout eskisini otomatik kapatir.
- **Siparis numarasi:** `Order` satiri yaratilirken `Order.paymentRef` alanina denemenin `merchant_oid` degeri yazilir.
- **Ayarlar:** `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, `PAYTR_TEST_MODE` (`apps/api/.env.example` icindeki aciklamalara bakin). Lokal gelistirmede callback'e ngrok gibi bir tunel gerekir.
- **Anahtarsiz mod:** Uc anahtar bosken checkout odeme adiminda `503` doner; siparis veya stok rezervi olusmaz.
- Seed sonrasinda:
  - birden fazla siparis durumu (`pending`, `processing`, `shipped`, `delivered`) gorunur
  - admin dashboard sifir olmayan satis ve stok metrikleri gosterir
  - bazi musteriler dolu sepet ve siparis gecmisi ile gelir
  - katalog ve admin ekranlari sadece DJI urun ailelerini gosterir

## Medya Depolama (Cloudflare R2)

Urun gorselleri, videolari ve video posterleri Cloudflare R2 uzerinde tutulur.
Yukleme yalnizca admin panelinden yapilir; API dosyayi dogrular, R2'ye yazar ve
donen herkese acik URL'yi urun kaydina isler.

### Kurulum

`apps/api/.env` icinde bes deger zorunludur. Nasil alinacagi `.env.example`
dosyasinda adim adim anlatilmistir:

```
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_BASE_URL=""
```

Bes deger de dolmadan yukleme calismaz; API, belirsiz bir 500 yerine net bir
yapilandirma hatasi doner. Bu davranis `src/lib/r2.ts` icindeki
`isR2Configured()` ile saglanir.

`R2_PUBLIC_BASE_URL` iki sekilde olabilir:

- **r2.dev** — bucket'ta "Public access" acilip verilen `https://pub-<hash>.r2.dev`
  adresi. Hizli baslangic icin uygundur, ancak hiz sinirlamasina tabidir ve
  uretim icin onerilmez.
- **Ozel alan adi** — uretim icin onerilen yontem. Bucket ayarlarindan
  `media.borabilgicteknik.com` gibi bir subdomain baglanir.

### Yukleme kurallari

Sinirlar `packages/types` icindeki `PRODUCT_MEDIA_LIMITS` ile hem API hem de
admin arayuzunde ayni kaynaktan okunur, bu yuzden iki tarafin eslesmesi bozulmaz.

| Tur | Kabul edilen formatlar | En buyuk boyut |
| --- | --- | --- |
| Gorsel | JPG, PNG, WEBP, AVIF | 5 MB |
| Poster | JPG, PNG, WEBP, AVIF | 3 MB |
| Video | MP4, WEBM | 100 MB |

Nesne anahtarlari `products/images/YYYY/MM/<ad>-<uuid>.<uzanti>` bicimindedir ve
bir yillik immutable cache basligiyla yazilir. Her yukleme yeni bir UUID
aldigindan anahtarlar tekrar kullanilmaz.

Bir urun guncellendiginde veya silindiginde, artik referans verilmeyen R2
nesneleri `deleteManyMediaFromR2` ile temizlenir. Bu temizlik en iyi cabadir:
R2 hatasi veritabani yazimini asla engellemez.

### Mevcut storefront gorsellerini R2'ye tasima

Seed verisi `apps/web/public/storefront/` altindaki yerel dosyalari isaret eder
(`/storefront/hero-drone.png` gibi). Bu dosyalar web paketinin icinde ~20 MB
yer kaplar. Tasima scripti bunlari R2'ye yukleyip veritabanindaki yollari yeni
URL'lerle degistirir:

```bash
npm run media:migrate -w apps/api              # onizleme, hicbir sey yazmaz
npm run media:migrate -w apps/api -- --apply   # yazma
```

Script varsayilan olarak onizleme modunda calisir. Tekrar calistirilabilir
(ayni dosya R2'de varsa yeniden yuklenmez) ve yerel dosyalari asla silmez —
siteyi R2 uzerinde dogruladiktan sonra `apps/web/public/storefront/` klasorunu
elle temizleyebilirsiniz.

Not: Yeni yuklemeler tam URL, eski seed verisi goreli yol kullandigi icin urun
medya URL'leri her iki bicimi de kabul eder. Boylece tasima tamamlanmadan da
mevcut urunler admin panelinden duzenlenebilir.

## Deployment

- Frontend production yayininda servis edilmesi gereken klasor: `apps/web/dist`
- Frontend build komutu: `npm run build:web`
- Render kullaniliyorsa kokteki `render.yaml` dosyasi static site'i dogrudan `apps/web/dist` klasorunden yayinlayacak sekilde hazirlandi.
- Production ortaminda `src/main.tsx`, `src/**/*.tsx` veya Vite dev server ciktilari servis edilmemelidir. Aksi halde `$RefreshSig$ is not defined` benzeri Fast Refresh hatalari gorulebilir.
