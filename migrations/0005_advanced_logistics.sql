-- Gelişmiş Lojistik ve Optimizasyon Algoritmaları Tabloları
-- 1. Çok Duraklı Rota & VRP Optimizasyonu
CREATE TABLE IF NOT EXISTS optimized_routes (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  arac_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  surucu_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  baslangic_depo_id TEXT REFERENCES warehouses(id),
  toplam_mesafe_km REAL NOT NULL DEFAULT 0,
  tahmini_sure_dk REAL NOT NULL DEFAULT 0,
  tahmini_yakit_litre REAL NOT NULL DEFAULT 0,
  karbon_emisyon_kg REAL NOT NULL DEFAULT 0,
  toplam_agirlik_kg REAL NOT NULL DEFAULT 0,
  durak_sayisi INTEGER NOT NULL DEFAULT 0,
  durum TEXT NOT NULL DEFAULT 'taslak', -- taslak | aktif | tamamlandi | iptal
  rota_geometrisi TEXT, -- JSON dizi: [{lat, lng, label}]
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_waypoints (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES optimized_routes(id) ON DELETE CASCADE,
  sira_no INTEGER NOT NULL,
  tur TEXT NOT NULL DEFAULT 'teslimat', -- baslangic | teslimat | toplama | bitis
  adres_baslik TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  ilgili_kisi TEXT,
  telefon TEXT,
  paket_adedi INTEGER DEFAULT 1,
  agirlik_kg REAL DEFAULT 0,
  hacim_m3 REAL DEFAULT 0,
  zaman_pencerisi_baslangic TEXT,
  zaman_pencerisi_bitis TEXT,
  tahmini_varis_saat TEXT,
  durum TEXT NOT NULL DEFAULT 'bekliyor', -- bekliyor | varis_yapildi | teslim_edildi | atlandi
  shipment_id TEXT REFERENCES shipments(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

-- 2. 3D Konteyner & Palet Yükleme Simülasyonu
CREATE TABLE IF NOT EXISTS packing_plans (
  id TEXT PRIMARY KEY,
  baslik TEXT NOT NULL,
  konteyner_tipi TEXT NOT NULL, -- standart_tir | 40ft_hc | 20ft_cnt | euro_palet | ozel
  konteyner_u REAL NOT NULL, -- cm
  konteyner_g REAL NOT NULL, -- cm
  konteyner_y REAL NOT NULL, -- cm
  maks_agirlik_kg REAL NOT NULL,
  toplam_koli_sayisi INTEGER NOT NULL DEFAULT 0,
  toplam_agirlik_kg REAL NOT NULL DEFAULT 0,
  hacim_doluluk_orani REAL NOT NULL DEFAULT 0, -- %
  agirlik_merkezi_x REAL,
  agirlik_merkezi_y REAL,
  agirlik_merkezi_z REAL,
  koli_verileri_json TEXT NOT NULL, -- JSON formatında koli girişleri ve 3D yerleşim koordinatları
  created_at INTEGER NOT NULL
);

-- 3. Dijital Teslim Kanıtı (e-POD)
CREATE TABLE IF NOT EXISTS proof_of_deliveries (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  alici_ad_soyad TEXT NOT NULL,
  alici_telefon TEXT,
  alici_tc_veya_unvan TEXT,
  imza_base64 TEXT NOT NULL,
  teslim_fotografi_url TEXT,
  teslim_lat REAL,
  teslim_lng REAL,
  notlar TEXT,
  created_at INTEGER NOT NULL
);

-- 4. Akıllı Depo ABC Slotting & Toplama Dalgası
CREATE TABLE IF NOT EXISTS picking_waves (
  id TEXT PRIMARY KEY,
  kod TEXT NOT NULL,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  durum TEXT NOT NULL DEFAULT 'hazirlaniyor', -- hazirlaniyor | toplaniyor | tamamlandi
  toplam_kalem INTEGER NOT NULL DEFAULT 0,
  toplam_adet REAL NOT NULL DEFAULT 0,
  rota_siralamasi_json TEXT, -- optimize edilmiş toplama adımları
  created_at INTEGER NOT NULL
);
