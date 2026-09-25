import { Link } from 'react-router-dom';

import { Seo } from '../../shared/components/Seo';
import { ServiceBand, StoreFooter } from './pages';

interface InfoSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

interface InfoPageProps {
  title: string;
  summary: string;
  pathLabel: string;
  highlights: Array<{ title: string; description: string }>;
  sections: InfoSection[];
  /** <title> için başlık-kasalı SEO metni (ör. "İade ve Değişim"). */
  seoTitle: string;
  /** Canonical yol (ör. "/iade"). */
  seoPath: string;
}

function InfoPage({ title, summary, pathLabel, highlights, sections, seoTitle, seoPath }: InfoPageProps) {
  return (
    <>
      <Seo description={summary} path={seoPath} title={seoTitle} />
      <section className="dji-contact-hero">
        <div className="ui-shell">
          <div className="dji-breadcrumbs">
            <Link to="/">Anasayfa</Link>
            <span>›</span>
            <span>{pathLabel}</span>
          </div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </section>

      <section className="dji-section">
        <div className="ui-shell">
          <div className="dji-info-grid">
            {highlights.map((item) => (
              <article className="dji-info-card" key={item.title}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <div className="dji-info-stack">
            {sections.map((section) => (
              <article className="dji-info-section" key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body ? <p>{section.body}</p> : null}
                {section.bullets?.length ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <ServiceBand />
      <StoreFooter />
    </>
  );
}

export function DeliveryPage() {
  return (
    <InfoPage
      highlights={[
        { title: 'Kargo Bilgilendirmesi', description: 'Siparişin teslimat yöntemi, kargo firması ve varsa kargo ücreti sepet ve ödeme adımlarında açıkça gösterilir.' },
        { title: 'Hızlı Sevkiyat', description: 'Hafta içi mesai saatlerinde onaylanan stoklu siparişler aynı gün veya en geç ertesi iş günü kargoya verilir.' },
        { title: 'Sipariş Takibi', description: 'Kargo çıkışı sonrası takip numarası e-posta ve SMS ile iletilir; teslimat süreci bilgi mesajlarıyla desteklenir.' },
      ]}
      pathLabel="Teslimat"
      sections={[
        {
          heading: 'Sipariş Hazırlama',
          body: 'Stokta bulunan ürünler, ödeme ve sipariş onayı sonrasında operasyon ekibi tarafından paketlenir ve sevke hazır hale getirilir.',
          bullets: [
            'Hafta içi mesai saatlerinde (Pazartesi–Cumartesi 09:00–19:00) onaylanan siparişler operasyon yoğunluğuna göre aynı gün veya ertesi iş günü kargoya verilir.',
            'Kurumsal veya teklif ile satılan ürünlerde sevk tarihi teklif ve termin bilgisi ile ayrıca netleştirilir.',
            'Kutu içeriği, aksesuar ve garanti durumu paketleme öncesi kontrol edilir.',
          ],
        },
        {
          heading: 'Kargo Ücreti',
          body: 'Kargo ücreti; sipariş içeriği, teslimat adresi, kampanya koşulları ve tercih edilen gönderim yöntemine göre ödeme adımında açıkça gösterilir.',
          bullets: [
            'Kampanya dönemlerinde gönderim koşulları değişebilir; geçerli uygulama sepet ve ödeme adımlarında belirtilir.',
            'Adres değişikliği veya ikinci gönderim taleplerinde ek kargo ücreti oluşabilir.',
          ],
        },
        {
          heading: 'Teslimat Süreleri',
          body: 'Tahmini teslimat süreleri, kargonun çıkış noktasından hedef adrese olan mesafeye ve kargo firmasının operasyon kapasitesine bağlıdır.',
          bullets: [
            'İstanbul içi standart sevkiyatlar genellikle 1 iş günü içinde teslim edilir.',
            'Diğer illere yapılan teslimatlar 1–3 iş günü arasında tamamlanır; uzak bölgelerde süre uzayabilir.',
            'Resmi tatillerde kargo firmalarının çalışma saatleri değişebileceğinden teslimat sürelerine 1–2 gün eklenmesi önerilir.',
            'Yoğun kampanya dönemleri ve olumsuz hava koşullarında süreler beklenenden uzun olabilir.',
          ],
        },
        {
          heading: 'Anlaşmalı Kargo Firmaları',
          body: 'Bora Bilgiç, anlaşmalı ulusal kargo firmaları aracılığıyla Türkiye geneline güvenli ve izlenebilir gönderim sağlar. Siparişinize atanan kargo firması, çıkış bildirimiyle birlikte paylaşılır.',
        },
        {
          heading: 'Sipariş Takibi',
          bullets: [
            'Kargoya verilen her sipariş için bir takip numarası oluşturulur ve müşteriye e-posta ile SMS yoluyla iletilir.',
            'Takip numarası ile kargo firmasının web sitesi veya mobil uygulaması üzerinden anlık durum sorgulanabilir.',
            'Herhangi bir gecikme veya sorun durumunda info@borabilgicteknik.com adresinden destek alınabilir.',
          ],
        },
        {
          heading: 'Teslimatta Kontrol',
          bullets: [
            'Kargo paketi teslim alınırken dış ambalajda ezilme, yırtılma veya ıslanma gibi fiziksel hasarlar mutlaka kontrol edilmelidir.',
            'Hasarlı paketlerde kargo görevlisi ile birlikte tutanak tutulması ve ürünün teslim alınmaması gerekir.',
            'Teslimat sonrası fark edilen eksiklik veya hasar durumunda aynı gün içinde +90 212 555 00 00 veya info@borabilgicteknik.com üzerinden bildirim yapılmalıdır.',
          ],
        },
        {
          heading: 'Kurumsal ve Adrese Teslim Detayları',
          bullets: [
            'Kurumsal siparişlerde fatura adresi ile teslimat adresi farklı olabilir; her iki adres de sipariş formunda ayrı ayrı girilmelidir.',
            'Toplu alımlarda paletli veya özel taşıma gerektiren ürünler için lojistik planlama ayrıca yapılır.',
            'Adreste bulunamama durumunda kargo firması şubede bekleme süresi uygular; bu süre sonunda iade işlemi başlatılabilir.',
          ],
        },
      ]}
      summary="Sipariş hazırlama, kargo ücreti, teslimat süreleri, sipariş takibi ve teslimatta kontrol adımları bu sayfada genel bilgilerle açıklanmıştır."
      title="KARGO VE TESLİMAT"
      seoTitle="Kargo ve Teslimat Bilgileri"
      seoPath="/teslimat"
    />
  );
}

export function AboutPage() {
  return (
    <InfoPage
      highlights={[
        { title: 'Uzman Ürün Seçimi', description: 'Drone, gimbal, aksiyon kamera ve profesyonel görüntüleme ekipmanlarında ihtiyaca uygun ürün seçimi sunulur.' },
        { title: 'Yetkili Satış Yaklaşımı', description: 'Satış öncesi bilgilendirme, fatura, garanti ve satış sonrası destek süreçleri şeffaf şekilde yürütülür.' },
        { title: 'Güvenli Alışveriş', description: 'Ürün açıklamaları, fiyatlar, ödeme adımları, teslimat ve iade koşulları satın alma öncesinde açıkça gösterilir.' },
      ]}
      pathLabel="Hakkımızda"
      sections={[
        {
          heading: 'Bora Bilgiç Teknik Kimdir?',
          body: 'Bora Bilgiç Teknik, profesyonel görüntüleme teknolojileri, drone sistemleri, gimbal çözümleri, aksiyon kameraları ve tamamlayıcı aksesuarları müşterileriyle buluşturan teknik odaklı bir satış ve destek platformudur.',
        },
        {
          heading: 'Ürün Gruplarımız',
          bullets: [
            'Drone ve uçuş ekipmanları',
            'Gimbal ve kamera stabilizasyon çözümleri',
            'Aksiyon kameraları ve creator ekipmanları',
            'Batarya, çanta, mikrofon, bağlantı ve yedek parça aksesuarları',
            'Kurumsal ihtiyaçlara yönelik proje ve toplu alım çözümleri',
          ],
        },
        {
          heading: 'Yetkili Satış ve Teknik Destek Yaklaşımı',
          body: 'Müşterilerimize yalnızca ürün satışı değil, doğru ürün seçimi, stok teyidi, garanti kapsamı, kurulum ihtiyacı ve satış sonrası destek konularında da anlaşılır bilgi sağlamayı hedefleriz.',
          bullets: [
            'Ürünlerin temel özellikleri ve fiyatları ürün sayfalarında açıkça paylaşılır.',
            'Satın alma öncesi teslimat, iade ve mesafeli satış koşulları erişilebilir tutulur.',
            'Sipariş sonrası fatura, kargo ve destek süreçleri kayıtlı şekilde takip edilir.',
          ],
        },
        {
          heading: 'Şeffaf Satın Alma Süreci',
          body: 'Sepet, teslimat bilgileri, fatura bilgileri ve ödeme adımları müşteriyi yormadan tamamlanacak şekilde tasarlanır. Sipariş sonrası kullanıcılar sipariş durumunu, kargo bilgisini, fatura durumunu ve iade taleplerini sistem üzerinden takip edebilir.',
        },
        {
          heading: 'Bize Ulaşın',
          body: 'Ürün seçimi, stok teyidi, kurumsal alım, teslimat, fatura veya iade süreçleriyle ilgili sorularınız için iletişim sayfamızdaki kanallardan bize ulaşabilirsiniz.',
          bullets: ['İletişim sayfası: /iletisim', 'E-posta: info@borabilgicteknik.com', 'Telefon ve çalışma saatleri güncel iletişim sayfasında paylaşılır.'],
        },
      ]}
      summary="Bora Bilgiç Teknik; profesyonel görüntüleme teknolojileri, drone, gimbal, aksiyon kamera ve aksesuar ürünlerinde şeffaf satış, fatura, teslimat, iade ve teknik destek süreçleri sunar."
      title="HAKKIMIZDA"
      seoTitle="Hakkımızda"
      seoPath="/hakkimizda"
    />
  );
}

export function ReturnPage() {
  return (
    <InfoPage
      highlights={[
        { title: '14 Gün Cayma Hakkı', description: 'Mesafeli Sözleşmeler Yönetmeliği kapsamında, istisna dışındaki ürünlerde teslimattan itibaren 14 gün içinde cayma hakkınızı kullanabilirsiniz.' },
        { title: 'Şeffaf İade Süreci', description: 'Başvurudan geri ödemeye kadar her adım e-posta ile bilgilendirilir; süreç takip edilebilir şekilde yürütülür.' },
        { title: 'Hızlı Geri Ödeme', description: 'Ürün kontrolü tamamlandıktan sonra geri ödeme en geç 14 gün içinde orijinal ödeme yöntemine yapılır.' },
      ]}
      pathLabel="İade ve Değişim"
      sections={[
        {
          heading: 'Cayma Hakkı',
          body: 'Mesafeli Sözleşmeler Yönetmeliği uyarınca, tüketiciler sözleşme konusu malın teslim tarihinden itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin cayma hakkına sahiptir. Cayma hakkı, aşağıda belirtilen istisnalar dışında tüm ürünler için geçerlidir.',
          bullets: [
            'Cayma hakkı süresi, ürünün tüketiciye veya tüketici tarafından belirlenen üçüncü kişiye teslim edildiği günden itibaren başlar.',
            'Cayma bildirimini info@borabilgicteknik.com adresine yazılı olarak veya +90 212 555 00 00 telefon hattından sözlü olarak iletebilirsiniz.',
            'Cayma hakkının kullanımında ürün bedelinin yanı sıra standart kargo ücreti de iade edilir.',
          ],
        },
        {
          heading: 'İade Koşulları',
          body: 'İadenin sorunsuz şekilde işleme alınabilmesi için aşağıdaki koşulların sağlanması gerekmektedir:',
          bullets: [
            'Ürün orijinal kutusu, tüm aksesuarları, koruma bantları ve faturası ile birlikte eksiksiz olarak gönderilmelidir.',
            'Ürün kullanılmamış, üzerinde çizik, leke veya kullanım izi bulunmamalıdır.',
            'Yazılım aktivasyonu, lisans kodu kullanımı veya kişisel veri kaydı yapılmış ürünlerde cayma hakkı uygulanamaz.',
            'Hijyen açısından kulaklık, mikrofon süngeri gibi doğrudan vücut teması gerektiren ürünlerde ambalaj açılmışsa iade kabul edilmez.',
          ],
        },
        {
          heading: 'İade Süreci Adım Adım',
          body: 'İade talebinizden geri ödemenize kadar olan süreç aşağıdaki adımlarla yürütülür:',
          bullets: [
            'Adım 1 – Başvuru: Sipariş numaranız ile info@borabilgicteknik.com adresine iade talebi oluşturun.',
            'Adım 2 – Onay: Destek ekibimiz talebinizi değerlendirir ve uygun ise iade onayı ile gönderim talimatını e-posta ile paylaşır.',
            'Adım 3 – Gönderim: Ürünü belirtilen adrese, paylaşılan kargo talimatlarına uygun şekilde gönderin. Kargo takip numarasını saklayınız.',
            'Adım 4 – Kontrol: Ürün operasyon merkezimize ulaştığında teknik ekip tarafından incelenir; eksiklik veya hasar durumu tespit edilir.',
            'Adım 5 – Geri Ödeme: Kontrol olumlu sonuçlandığında ürün bedeli en geç 14 gün içinde orijinal ödeme yöntemine iade edilir.',
          ],
        },
        {
          heading: 'Geri Ödeme Süresi',
          body: 'Ürün kontrolü tamamlandıktan sonra geri ödeme işlemi başlatılır. Banka ve ödeme sağlayıcısına bağlı olarak tutarın hesaba yansıması 3–14 gün arasında değişebilir. Taksitli ödemelerde iade, bankanın politikasına göre tek seferde veya taksitler halinde yapılabilir.',
        },
        {
          heading: 'Değişim İşlemleri',
          body: 'Aynı modelin farklı renk veya konfigürasyonu gibi değişim talepleri, stok durumuna göre değerlendirilir. Değişim sürecinde fiyat farkı oluşursa müşteriye ayrıca bilgi verilir.',
          bullets: [
            'Değişim talepleri de 14 günlük cayma süresi içinde yapılmalıdır.',
            'Değişime konu ürünün iade koşullarını sağlaması gerekir.',
            'Stokta bulunmayan modeller için sipariş iptali ve yeniden satın alma önerilebilir.',
          ],
        },
        {
          heading: 'Hasarlı Teslimat Prosedürü',
          body: 'Kargo paketinde gözle görülür hasar varsa teslim almadan önce kargo görevlisi ile birlikte tutanak tutulmalıdır. Hasarlı kabul edilen paket teslim alınmamalıdır.',
          bullets: [
            'Teslimat sırasında hasar fark edilmediyse, aynı gün içinde +90 212 555 00 00 veya info@borabilgicteknik.com üzerinden bildirim yapılmalıdır.',
            'Hasarlı ürün için fotoğraf ve tutanak bilgisi talep edilebilir.',
            'Taşıma kaynaklı hasarlarda kargo firması ile gerekli süreç Bora Bilgiç tarafından takip edilir.',
          ],
        },
        {
          heading: 'İstisnalar',
          bullets: [
            'Lisans anahtarı açıklanmış veya yazılım aktivasyonu tamamlanmış ürünler iade edilemez.',
            'Kişiye özel hazırlanan, gravürlü veya modifiye edilmiş ürünlerde cayma hakkı geçerli değildir.',
            'Kurumsal teklif kapsamındaki projelerde iade ve değişim koşulları teklif dokümanıyla belirlenir.',
          ],
        },
      ]}
      summary="14 günlük cayma hakkı, iade koşulları, adım adım iade süreci, geri ödeme süreleri, değişim işlemleri ve hasarlı teslimat prosedürü bu sayfada detaylı olarak açıklanmıştır."
      title="İADE VE DEĞİŞİM"
      seoTitle="İade ve Değişim"
      seoPath="/iade"
    />
  );
}

export function DistanceSalesPage() {
  return (
    <InfoPage
      highlights={[
        { title: 'Ön Bilgilendirme', description: 'Bu sayfa, Mesafeli Sözleşmeler Yönetmeliği uyarınca tüketicilere sunulan genel ön bilgilendirme metnidir; her sipariş için ayrıca sözleşme oluşturulur.' },
        { title: 'Şeffaf Ticari Koşullar', description: 'Ürün özellikleri, fiyatlandırma, ödeme yöntemleri, teslimat süresi ve cayma hakkı sipariş onayından önce açıkça sunulur.' },
        { title: 'Yasal Güvence', description: 'Uyuşmazlık durumunda Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir; tüketici hakları yasal mevzuatla korunur.' },
      ]}
      pathLabel="Mesafeli Satış"
      sections={[
        {
          heading: 'Taraflar',
          body: 'Bu ön bilgilendirme metni, aşağıda bilgileri yer alan satıcı ile elektronik ortamda sipariş veren alıcı arasındaki mesafeli satış ilişkisine dair genel çerçeveyi belirler.',
          bullets: [
            'Satıcı: Bora Bilgiç – Maslak Mah. Teknik Plaza No: 18 / İstanbul | E-posta: info@borabilgicteknik.com | Telefon: +90 212 555 00 00',
            'Alıcı: Web sitesi üzerinden sipariş veren gerçek veya tüzel kişi olup, sipariş formunda beyan ettiği kimlik ve iletişim bilgilerinden sorumludur.',
          ],
        },
        {
          heading: 'Sözleşme Konusu',
          body: 'Mesafeli satış sözleşmesinin konusu, alıcının satıcının web sitesinden elektronik ortamda sipariş verdiği ürün veya ürünlerin satışı ve teslimidir. Her sipariş için ayrı bir sözleşme kurulur ve bu sayfadaki genel hükümler o sözleşmenin tamamlayıcı parçasıdır.',
        },
        {
          heading: 'Ürün Bilgileri ve Fiyatlandırma',
          bullets: [
            'Ürünün temel nitelikleri, teknik özellikleri, stok durumu ve satış fiyatı ürün sayfasında gösterilir.',
            'Fiyatlara KDV dahildir; kargo ücreti sepet aşamasında ayrıca belirtilir.',
            'Kampanyalı fiyatlar sınırlı süreyle geçerlidir; satıcı fiyat güncelleme hakkını saklı tutar ancak onaylanmış siparişlerin fiyatı değişmez.',
            'Teklif bazlı kurumsal satışlarda fiyat ve koşullar teklif dokümanıyla bağlayıcı hale gelir.',
          ],
        },
        {
          heading: 'Ödeme Koşulları',
          bullets: [
            'Ödeme; kredi kartı, banka kartı veya havale/EFT yöntemleriyle yapılabilir.',
            'Kart bilgileri güvenli ödeme altyapısı üzerinden işlenir; satıcı kart verilerini saklamaz.',
            'Havale/EFT ile yapılan ödemelerde sipariş, tutar hesaba geçtikten sonra onaylanır.',
            'Taksit seçenekleri, kullanılan kartın bankasına göre değişiklik gösterebilir.',
          ],
        },
        {
          heading: 'Teslimat Koşulları',
          body: 'Teslimat, anlaşmalı ulusal kargo firmaları aracılığıyla alıcının belirttiği adrese yapılır. Detaylı kargo ve teslimat bilgileri için "Kargo ve Teslimat" sayfasına bakınız.',
          bullets: [
            'Stoklu ürünlerde teslimat süresi İstanbul içi 1 iş günü, diğer iller 1–3 iş günüdür.',
            'Kargo ücreti ve gönderim yöntemi sepet ve ödeme adımlarında ayrıca belirtilir.',
            'Resmi tatiller ve olağanüstü durumlarda teslimat süreleri uzayabilir.',
          ],
        },
        {
          heading: 'Cayma Hakkı ve İstisnalar',
          body: 'Alıcı, Mesafeli Sözleşmeler Yönetmeliği kapsamında teslim tarihinden itibaren 14 gün içinde cayma hakkına sahiptir. Cayma hakkının kullanımı ve iade süreci hakkında detaylı bilgi için "İade ve Değişim" sayfasını inceleyiniz.',
          bullets: [
            'Lisans aktivasyonu yapılmış, yazılım kodu kullanılmış veya kişisel veri kaydedilmiş ürünlerde cayma hakkı uygulanamaz.',
            'Hijyen ürünlerinde ambalaj açılmışsa iade kabul edilmez.',
            'Kişiye özel üretilen veya modifiye edilen ürünler cayma hakkı kapsamı dışındadır.',
            'Cayma bildirimi info@borabilgicteknik.com adresine yazılı olarak yapılmalıdır.',
          ],
        },
        {
          heading: 'Uyuşmazlık Çözümü',
          body: 'Mesafeli satış sözleşmesinden doğan uyuşmazlıklarda, Ticaret Bakanlığınca her yıl belirlenen parasal sınırlar dahilinde Tüketici Hakem Heyetleri görevlidir. Parasal sınırın üzerindeki uyuşmazlıklarda ise Tüketici Mahkemeleri yetkilidir.',
          bullets: [
            'Alıcı, şikayetini öncelikle satıcıya info@borabilgicteknik.com veya +90 212 555 00 00 hattından iletmelidir.',
            'Satıcı, başvuruyu en geç 14 gün içinde sonuçlandırmayı hedefler.',
            'Anlaşma sağlanamaması halinde alıcı, ikametgahının bulunduğu yerdeki Tüketici Hakem Heyeti veya Tüketici Mahkemesine başvurabilir.',
          ],
        },
        {
          heading: 'Genel Hükümler',
          bullets: [
            'Bu ön bilgilendirme metni, yürürlükteki Mesafeli Sözleşmeler Yönetmeliği ve Tüketicinin Korunması Hakkında Kanun hükümlerine göre hazırlanmıştır.',
            'Satıcı, mevzuat değişiklikleri doğrultusunda bu metni güncelleme hakkını saklı tutar.',
            'Sipariş onayı sırasında alıcı, bu ön bilgilendirmeyi okuduğunu ve kabul ettiğini elektronik olarak beyan eder.',
          ],
        },
      ]}
      summary="Mesafeli satış sözleşmesine ilişkin taraflar, sözleşme konusu, ürün bilgileri, fiyatlandırma, ödeme ve teslimat koşulları, cayma hakkı ile uyuşmazlık çözümüne dair genel ön bilgilendirme bu sayfada yer almaktadır."
      title="MESAFELİ SATIŞ ÖN BİLGİLENDİRME"
      seoTitle="Mesafeli Satış Ön Bilgilendirme"
      seoPath="/mesafeli-satis"
    />
  );
}

export function PrivacyPage() {
  return (
    <InfoPage
      highlights={[
        { title: 'Veri Toplama', description: 'Sipariş, iletişim ve destek süreçlerinde gerekli olan temel kimlik ve iletişim bilgileri işlenir.' },
        { title: 'Kullanım Amacı', description: 'Toplanan veriler sipariş yönetimi, teslimat, destek ve yasal yükümlülüklerin yerine getirilmesi için kullanılır.' },
        { title: 'Koruma', description: 'Veri güvenliği için teknik ve idari tedbirler uygulanır; ödeme verileri güvenli ödeme sağlayıcıları üzerinden işlenir.' },
      ]}
      pathLabel="Gizlilik"
      sections={[
        {
          heading: 'İşlenen Veriler',
          bullets: [
            'Ad, soyad, e-posta, telefon, teslimat ve fatura adresi',
            'Sipariş içeriği, ürün tercihleri ve destek kayıtları',
            'Yasal zorunluluk halinde işlem kayıtları ve finansal hareket özetleri',
          ],
        },
        {
          heading: 'Kullanım Amaçları',
          bullets: [
            'Sipariş alma, kargo planlama ve müşteri hizmetleri sunma',
            'İade, değişim ve teknik destek sürecini yürütme',
            'Yasal, ticari ve mali yükümlülükleri yerine getirme',
          ],
        },
        {
          heading: 'Saklama ve Haklar',
          body: 'Kişisel veriler, ilgili mevzuat ve ticari zorunluluklar çerçevesinde gerekli olduğu süre kadar saklanır.',
          bullets: [
            'Kullanıcı, verilerine ilişkin bilgi talep edebilir ve gerekli durumlarda güncelleme isteyebilir.',
            'Mevzuata uygun hallerde silme, düzeltme veya itiraz başvuruları yapılabilir.',
            'Başvurular info@borabilgicteknik.com üzerinden yazılı olarak iletilebilir.',
          ],
        },
      ]}
      summary="Kişisel verilerin hangi kapsamda toplandığı, ne amaçla kullanıldığı ve hangi güvenlik tedbirleriyle korunduğu bu sayfada açıkça belirtilir."
      title="GİZLİLİK POLİTİKASI"
      seoTitle="Gizlilik Politikası"
      seoPath="/gizlilik"
    />
  );
}
