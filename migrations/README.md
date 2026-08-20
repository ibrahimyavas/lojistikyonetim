# Migrations

Numaralı SQL dosyaları (`0001_...sql`, `0002_...sql`, ...) - barkod-okuyucu
projesindeki aynı konvansiyon: additive, bir kez uygulanan bir migration
dosyası bir daha DEĞİŞTİRİLMEZ, yeni bir değişiklik her zaman yeni bir
numaralı dosya olarak eklenir.

```bash
npm run db:migrate:local    # yerel D1
XDG_CONFIG_HOME=/home/fcu/.config npx wrangler d1 migrations apply lojistik-db --remote
```

Henüz şema tasarlanmadı - ilk migration (araç/sürücü/sevkiyat tabloları)
eklenince bu dosya silinebilir.
