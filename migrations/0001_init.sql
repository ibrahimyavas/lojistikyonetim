-- İlk gerçek şema: Sürücüler, Araçlar, Depolar - filo + depo takibinin
-- temel varlıkları. Sevkiyat/rota/depo hareketi tabloları bunlara referans
-- verecek şekilde sonraki migration'larda eklenecek.

-- Sürücü kimlik doğrulaması admin panelinden AYRI: paylaşılan şifre değil,
-- her sürücünün kendi kodu + PIN'i var (bkz. worker/driverAuth.js). PIN
-- düz metin DEĞİL, hash'lenmiş olarak tutuluyor (SHA-256 + DRIVER_PIN_PEPPER
-- secret) - admin panelindeki AUTH_PASSWORD'den farklı olarak burada her
-- kayıt kendi sırrını taşıdığı için tek bir env değişkeni yeterli değil.
CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  kod TEXT NOT NULL UNIQUE, -- sürücü app girişinde kullanılan kısa kod
  telefon TEXT,
  pin_hash TEXT NOT NULL,
  aktif INTEGER NOT NULL DEFAULT 1,
  not_metni TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  plaka TEXT NOT NULL,
  marka_model TEXT,
  durum TEXT NOT NULL DEFAULT 'aktif', -- aktif | bakimda | pasif
  surucu_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  not_metni TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE warehouses (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  konum TEXT,
  kapasite REAL,
  not_metni TEXT,
  created_at INTEGER NOT NULL
);
