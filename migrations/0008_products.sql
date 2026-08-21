-- Ürün kataloğu: "bu üründen bir palete kaç tane sığar" ve "palet ne kadar
-- büyük" bilgisi artık her palet eklerken elle tekrar tekrar girilmek yerine
-- ürün başına BİR KEZ tanımlanıyor - palet eklerken ürün adı yazıldığında
-- (bkz. worker/pallets.js'e dokunulmadı, eşleştirme frontend'de PalletsDashboard
-- içinde ad üzerinden yapılıyor) bu değerler otomatik öneri olarak kullanılıyor,
-- suggestZoneForProduct'taki "bir kere tanımla, her yerde otomatik kullan"
-- mantığıyla aynı.
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL UNIQUE,
  birim TEXT,
  palet_basina_adet REAL,
  palet_uzunluk_cm REAL,
  palet_genislik_cm REAL,
  palet_yukseklik_cm REAL,
  palet_agirlik_kg REAL,
  not_metni TEXT,
  created_at INTEGER NOT NULL
);
