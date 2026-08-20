-- Depo bölümlerine açık bir hız/öncelik sınıfı (A/B/C) eklenir. Bu, otomatik
-- bölüm önerisi algoritmasının (bkz. src/lib/slottingAlgorithms.js
-- suggestZoneForProduct) "hangi bölüm rampaya yakın/hızlı sirkülasyon" gibi
-- kod/ad metnini tahmin etmeye ("A-..." ile başlıyor mu, adında "hızlı" mı
-- geçiyor mu) çalışmak yerine gerçek, admin'in belirlediği bir veriye
-- dayanmasını sağlar. NULL = henüz sınıflandırılmamış (opsiyonel alan,
-- mevcut bölümler etkilenmez, algoritma bu durumda eski metin sezgisine
-- geri düşer).
ALTER TABLE warehouse_zones ADD COLUMN sinif TEXT;
