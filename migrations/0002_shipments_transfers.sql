-- Sevkiyat (dış - müşteri/tedarikçiye giden/gelen) ve Depo Transferi (iç -
-- depolarımız arası) takibi. barkod-okuyucu ERP'sindeki Lojistik/İç
-- Lojistik modüllerinin özelleşmiş hali: araç/sürücü artık serbest metin
-- değil, gerçek vehicles/drivers kayıtlarına referans (ON DELETE SET NULL -
-- bir araç/sürücü silinirse sevkiyat "atanmamış" olur, kayıt kaybolmaz).
-- Konum alanları (çıkış/varış) bilinçli olarak serbest metin kaldı - varış
-- çoğu zaman müşterinin adresi, bizim bir deponuz olmayabilir.
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  yon TEXT NOT NULL DEFAULT 'giden', -- giden (müşteriye) | gelen (tedarikçiden)
  taraf_adi TEXT NOT NULL,
  taraf_telefon TEXT,
  barkod TEXT,
  urun_adi TEXT,
  arac_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  surucu_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  cikis_konumu TEXT,
  varis_konumu TEXT,
  planlanan_tarih TEXT,
  gerceklesen_tarih TEXT,
  durum TEXT NOT NULL DEFAULT 'planlandi', -- planlandi | yolda | teslim_edildi | iptal
  not_metni TEXT,
  created_at INTEGER NOT NULL
);

-- kaynak/hedef HER ZAMAN kendi depolarımızdan biri (barkod-okuyucu'daki
-- depo_transferleri'nden fark: orada serbest metindi, burada gerçek FK -
-- ileride "depo bazında stok" gibi özellikler bu sayede mümkün).
CREATE TABLE warehouse_transfers (
  id TEXT PRIMARY KEY,
  barkod TEXT,
  urun_adi TEXT NOT NULL,
  miktar REAL,
  birim TEXT,
  kaynak_depo_id TEXT NOT NULL REFERENCES warehouses(id),
  hedef_depo_id TEXT NOT NULL REFERENCES warehouses(id),
  tarih TEXT,
  durum TEXT NOT NULL DEFAULT 'planlandi', -- planlandi | tamamlandi
  not_metni TEXT,
  created_at INTEGER NOT NULL
);
