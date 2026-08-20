-- Sürücü GPS konum geçmişi - Android sürücü app'i buraya periyodik konum
-- bildirimi yapacak (worker/driverLocations.js, requireDriverAuth). Ayrı
-- bir "son konum" sütunu/tablosu YOK - depo bölümü doluluk hesabıyla aynı
-- felsefe: "şu an nerede" her zaman bu tablodaki EN SON kayıttan CANLI
-- hesaplanıyor, iki yapı birbirinden asenkron sapmasın diye. İbrahim'in
-- "çok yoğun değil" kullanım tarifine göre - sık ping'lerde büyüyen bir
-- tablo burada sorun değil, gerekirse ileride eskiler arşivlenebilir.
CREATE TABLE driver_locations (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  dogruluk REAL, -- GPS doğruluk yarıçapı, metre (Android app FusedLocationProvider'dan)
  hiz REAL, -- km/s, opsiyonel
  kaydedilen_zaman INTEGER, -- cihazdaki ölçüm anı (epoch ms) - ağ gecikmesi/kuyruklama olursa created_at'tan farklı olabilir
  created_at INTEGER NOT NULL
);

-- "Her sürücünün son konumu" sorgusu (worker/driverLocations.js
-- listLastLocations) sürücü bazında en yüksek created_at'ı arıyor - bu
-- indeks olmadan tablo büyüdükçe tam tarama gerekirdi.
CREATE INDEX idx_driver_locations_driver_created ON driver_locations (driver_id, created_at DESC);
