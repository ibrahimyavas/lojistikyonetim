-- Depo yönetimi: bölüm/alan tanımı + kapasite takibi, palet bazlı envanter
-- (mal kabul/mal çıkış hareketleri), parti/üretim tarihi ile FIFO önceliği.
-- Ayrıca satın alma sonrası gelen sevkiyatın hangi depoya/kime teslim
-- edileceği bilgisi shipments'a ekleniyor.

-- Bir deponun içindeki bölüm/raf/alan tanımları - kapasite buradan takip
-- ediliyor (doluluk, pallets tablosundan CANLI hesaplanıyor, ayrı bir sayaç
-- SÜTUNU YOK ki iki tablo birbirinden asenkron sapmasın - bkz.
-- worker/warehouseZones.js).
CREATE TABLE warehouse_zones (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  kod TEXT NOT NULL,
  ad TEXT,
  kapasite REAL,
  not_metni TEXT,
  created_at INTEGER NOT NULL
);

-- Palet = depodaki envanterin taşıma birimi. zone_id NULL ise "depoda ama
-- bir bölüme yerleştirilmemiş" ya da (durum='sevk_edildi' iken) "artık
-- depoda değil" anlamına gelir. parti_no + uretim_tarihi FIFO sıralaması
-- için (bkz. worker/pallets.js listPallets - varsayılan sıralama en eski
-- üretim tarihi önce).
CREATE TABLE pallets (
  id TEXT PRIMARY KEY,
  kod TEXT NOT NULL,
  warehouse_id TEXT REFERENCES warehouses(id) ON DELETE SET NULL,
  zone_id TEXT REFERENCES warehouse_zones(id) ON DELETE SET NULL,
  urun_adi TEXT NOT NULL,
  parti_no TEXT,
  uretim_tarihi TEXT,
  miktar REAL,
  birim TEXT,
  durum TEXT NOT NULL DEFAULT 'depoda', -- depoda | sevk_edildi
  not_metni TEXT,
  created_at INTEGER NOT NULL
);

-- Mal kabul (giris) / mal çıkış (cikis) / bölüm değişikliği (transfer)
-- hareket geçmişi - salt-okunur denetim izi, worker tarafından palet
-- oluşturulduğunda/güncellendiğinde otomatik ekleniyor (bkz.
-- worker/pallets.js), doğrudan bir CRUD ekranı yok.
CREATE TABLE pallet_movements (
  id TEXT PRIMARY KEY,
  pallet_id TEXT NOT NULL REFERENCES pallets(id) ON DELETE CASCADE,
  tur TEXT NOT NULL, -- giris | cikis | transfer
  zone_id TEXT REFERENCES warehouse_zones(id) ON DELETE SET NULL,
  miktar REAL,
  tarih TEXT,
  not_metni TEXT,
  created_at INTEGER NOT NULL
);

-- Satın alma sonrası gelen sevkiyatın (shipments.yon='gelen') hangi
-- deponuza/kime teslim edileceği - "gelen" sevkiyatlarda opsiyonel.
ALTER TABLE shipments ADD COLUMN teslim_depo_id TEXT REFERENCES warehouses(id);
ALTER TABLE shipments ADD COLUMN teslim_alan_kisi TEXT;
