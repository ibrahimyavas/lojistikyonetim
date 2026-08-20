-- Web paneli kullanıcıları (Yönetici/Operatör). Şoför rolü AYRI bir
-- kullanıcı kaydı DEĞİL - mevcut drivers tablosunu (kod+PIN) kullanıyor,
-- bkz. worker/auth.js login: hem users hem drivers tablosuna bakıyor, aynı
-- kod+PIN Android app'e VE web paneline giriş için geçerli.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  kullanici_adi TEXT NOT NULL UNIQUE,
  sifre_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'operator', -- yonetici | operator
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
