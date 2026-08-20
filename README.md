# Lojistik

İbrahim'in barkod-okuyucu (Small ERP) projesindeki Lojistik/İç Lojistik
modüllerinden ayrılan, kendi başına büyüyecek, özelleşmiş bir lojistik/filo
yönetim sistemi. **barkod-okuyucu ile bağlantısı yok** - ayrı repo, ayrı
Cloudflare Worker + D1, ayrı deploy.

## Kapsam (planlanan)

- Web paneli: dispatcher/admin kullanımı - araç, sürücü, sevkiyat/rota
  yönetimi, filo genel görünümü.
- Android sürücü uygulaması (ayrı proje/repo olacak, ileride): GPS konum
  bildirimi (orta yoğunlukta, sürekli değil), sürücüye görev/bilgilendirme
  gönderimi. Bu Worker'a REST ile konuşacak.
- Gerçek zamanlı konum/bildirim ihtiyacı doğduğunda Durable Objects
  eklenecek (WebSocket ya da push) - şimdilik REST + D1 yeterli.

## Mimari

barkod-okuyucu'daki kanıtlanmış desenin birebir aynısı:

- Tek Cloudflare Worker (`worker/index.js`), `/api/*` altında modül başına
  bir route dosyası (`worker/<modül>.js`), `handleXxxRoute(request, env,
  pathname)` deseniyle kayıt oluyor.
- D1 (SQLite) - `migrations/` altında numaralı SQL dosyaları,
  `npm run db:migrate:local` / `db:migrate:remote`.
- Web paneli: Vite + React SPA (`src/`), Worker `dist/`'i statik olarak
  sunuyor (`env.ASSETS`), `/api/*` dışındaki her yol SPA'ya düşüyor.
- Web paneli girişi: tek paylaşılan şifre + imzalı çerez oturumu
  (`worker/auth.js`) - barkod-okuyucu ile birebir aynı, dahili/güvenilir
  kullanım için yeterli.
- **Android app auth'u FARKLI olacak**: tek paylaşılan şifre değil, her
  sürücünün kendi kimliği/token'ı - henüz tasarlanmadı, sürücü/araç şeması
  netleşince eklenecek.

## Yerel geliştirme

```bash
cp .dev.vars.example .dev.vars   # AUTH_PASSWORD / SESSION_SECRET doldur
npm install
npm run worker:dev   # :8788 - Worker + D1 (local)
npm run dev          # :5175 - Vite, /api isteklerini worker:dev'e proxy'ler
```

`npm run cf:dev` derlenmiş SPA'yı Wrangler üzerinden uçtan uca dener
(gerçek prod'a en yakın yerel test).

## Deploy

Bu sandbox'ta wrangler'ın kimlik bilgilerini bulması için
`XDG_CONFIG_HOME=/home/fcu/.config` ortam değişkenini önüne eklemek
gerekiyor:

```bash
XDG_CONFIG_HOME=/home/fcu/.config npx wrangler d1 migrations apply lojistik-db --remote
XDG_CONFIG_HOME=/home/fcu/.config npm run deploy
```

## Durum

İskelet kuruldu (auth + tema + boş panel). Sıradaki adım: araç/sürücü/
sevkiyat/rota veri şemasını tasarlayıp ilk gerçek modülü eklemek.
