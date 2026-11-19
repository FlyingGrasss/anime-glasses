# Anime Gözlük

Web kameranı gerçek zamanlı bir anime sahnesine çeviren, tamamen tarayıcıda
çalışan küçük bir demo. Yüzünde iri parlak gözler, yanak allığı, ışıltılar,
isteğe bağlı kedi kulakları ve konuşma balonu çizilir. Fotoğraf çekince PNG
indirilir ve cihazda rastgele bir “kişilik kartı” oluşturulur.

> **Gizlilik:** Her şey tarayıcında çalışır; görüntü hiçbir yere gönderilmez.
> Kamera akışı ve yüz işaretleri cihazdan ayrılmaz.

## Özellikler

- `getUserMedia` ile web kamerası; aynalı önizleme.
- `@mediapipe/tasks-vision` Face Landmarker ile yüz işaretleri.
- Cihaz piksel oranı en fazla 2 olacak şekilde canvas katmanı.
- Açılıp kapanabilen katmanlar: anime gözler, yanak allığı, 8 parçacıklı
  ışıltı seti, kedi kulakları, rastgele konuşma balonu.
- 0–100 arası efekt yoğunluğu.
- PNG anlık görüntü indirme ve yerel kişilik kartı (arketip + tagline).
- MediaPipe yüklenemezse otomatik “basit mod”: merkezî oval ve elle
  “Yüzü hizala” kalibrasyonu.
- Tamamen statik dışa aktarılabilir (`output: "export"`), API veya veritabanı
  yoktur.
- Türkçe arayüz, açık minimal tasarım.

## Gereksinimler

- Node.js 20.9 veya üzeri
- pnpm 10 veya üzeri
- HTTPS veya `localhost` (tarayıcılar kamera erişimini güvenli bağlamla
  sınırlar)

## Kurulum

```bash
pnpm install
pnpm dev
```

`pnpm install`, `prepare` betiğini çalıştırır. Betik:

1. `node_modules/@mediapipe/tasks-vision/wasm/` içeriğini
   `public/mediapipe/wasm/` altına kopyalar.
2. Face Landmarker modeli yoksa indirir ve
   `public/mediapipe/face_landmarker.task` olarak kaydeder.
3. `public/mediapipe/manifest.json` içine dosya bilgilerini yazar.

`predev` ve `prebuild` aynı betiği yeniden çalıştırır; mevcut dosyalar
korunur. Betik ağ olmadan da çalışır. Model daha önce indirilmediyse ve ağ
yoksa hazırlık betiği uyarı verir; uygulama yine açılır ve basit moda geçer.
Modeli daha sonra `pnpm prepare:mediapipe` ile indirebilirsiniz.

### Model varlıkları ve çevrimdışı kullanım

Depodaki `public/mediapipe/` klasörü çevrimdışı çalışacak şekilde commit
edilmelidir. Gerekli dosyalar:

```text
public/mediapipe/
├── face_landmarker.task
├── manifest.json
└── wasm/
    ├── vision_wasm_internal.js
    ├── vision_wasm_internal.wasm
    ├── vision_wasm_module_internal.js
    └── vision_wasm_module_internal.wasm
```

Model kaynağı:

```text
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```

Model yaklaşık 3.6 MB, WASM dosyaları toplam yaklaşık 30 MB'tır. Çevrimdışı
bir makinede kurulum için bu dosyaları başka bir ortamda bir kez hazırlayıp
`public/mediapipe/` altına kopyalayın. Doğrulamak için:

```bash
pnpm prepare:mediapipe -- --check
```

Model indirilemezse uygulama açılmaya devam eder; yüz algılama yerine basit
mod kullanılır. Basit modda merkezdeki ovali kullanarak yüzünü hizalayıp
“Yüzü hizala”ya basman gerekir.

## Kullanım

1. “Kamerayı başlat”a bas ve kamera iznini ver.
2. Yüzünü kameraya göster. Model yüklenirken kısa bir bekleme olabilir.
3. Sağdaki katmanları ve yoğunluk kaydırıcısını ayarla.
4. “Fotoğraf çek” ile PNG indir; kişilik kartı açılır. “Kartı indir (PNG)” ile
   1080×1350 paylaşılabilir kartı indir.
5. “Kamera durdur” görüntü akışını ve kamera kaynağını serbest bırakır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `pnpm dev` | Geliştirme sunucusu |
| `pnpm build` | Statik üretim çıktısı (`out/`) |
| `pnpm typecheck` | TypeScript kontrolü |
| `pnpm lint` | ESLint |
| `pnpm check:lib` | `src/lib/anime.ts` için saf fonksiyon kontrolleri |
| `pnpm prepare:mediapipe` | WASM kopyala, modeli indir |
| `pnpm prepare:mediapipe -- --check` | Varlıkları ağ olmadan doğrula |

Statik çıktıyı yerelde sunmak için:

```bash
pnpm build
pnpm dlx serve out
```

## Vercel'e dağıtım

1. Projeyi GitHub'a gönderin. `public/mediapipe/` varlıklarını da commit edin;
   böylece derleme sırasında model indirmeye gerek kalmaz.
2. Vercel'de **Add New → Project** ile depoyu içe aktarın.
3. Framework preset olarak **Next.js** seçin. Build komutu `pnpm build`,
   çıktı dizini otomatik olarak `out` olur (`next.config.ts` içinde
   `output: "export"`).
4. Deploy sonrası siteyi HTTPS üzerinden açın; kamera ancak güvenli bağlamda
   çalışır.

Vercel'de `pnpm install` sırasında `prepare` çalışır. Model dosyaları repoda
yoksa derleme ortamının dış ağa erişimi gerekir.

GitHub bağlantısı `src/app/page.tsx` içindeki `GITHUB_URL` yer tutucusundan
güncellenmelidir.

## Sınırlamalar

- **Işık:** Arka ışık, düşük ışık ve sert gölgeler landmark güvenini düşürür.
  Yüzün aydınlık tarafa dönük olması en iyi sonucu verir.
- **Gözlük:** Çerçeve, kalın cam ve yansımalar göz çevresi işaretlerini
  bozabilir. Anime gözler yine çizilir, ancak hizası kayabilir.
- **Tek yüz:** Yalnızca ilk yüz izlenir; kalabalık sahnelerde diğer yüzler
  efektsiz kalır.
- **Poz ve kapanma:** Profil, el, maske veya saçla kapanan yüzlerde algılama
  kaybolabilir.
- **Başlangıç maliyeti:** WASM ve model yerelden yüklenir; ilk algılama
  birkaç saniye sürebilir. GPU yoksa CPU yedeği kullanılır.
- **Basit mod:** Otomatik takip yapmaz; yalnızca merkezî ovalin içindeki
  varsayılan yüz konumuna efekt çizer.
- **Amaç:** Bu bir eğlence demosudur. Biyometrik tanımlama, güvenlik veya
  tıbbi kullanım için tasarlanmamıştır.

## Teknik notlar

- Saf yardımcılar `src/lib/anime.ts` içinde; landmark'tan göz geometrisi,
  arketip seçimi ve yumuşatma burada test edilir.
- Canvas çizimi `src/lib/canvas-effects.ts`, kişilik kartı üretimi
  `src/lib/share-card.ts` içindedir.
- Uygulama tek bir istemci bileşeniyle (`src/components/anime-glasses-app.tsx`)
  kamera, algılama ve çizim döngüsünü yönetir. Sayfa statik olarak üretilir.
