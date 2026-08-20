import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashPin } from "../worker/driverAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "lojistik.sqlite");
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

export async function createD1Database(envConfig = {}) {
  const SQL = await initSqlJs();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let db;
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn("Could not load existing db file, creating new one:", err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON;");

  function saveDb() {
    try {
      const data = db.export();
      fs.writeFileSync(DB_FILE, Buffer.from(data));
    } catch (err) {
      console.error("Failed to persist database to file:", err);
    }
  }

  // Apply migrations if not applied
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations_applied (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  if (fs.existsSync(MIGRATIONS_DIR)) {
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const checkStmt = db.prepare("SELECT name FROM _migrations_applied WHERE name = ?1");
      checkStmt.bind([file]);
      const hasApplied = checkStmt.step();
      checkStmt.free();

      if (!hasApplied) {
        console.log(`Applying migration: ${file}`);
        const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        db.exec(sqlContent);
        const recordStmt = db.prepare("INSERT INTO _migrations_applied (name, applied_at) VALUES (?1, ?2)");
        recordStmt.bind([file, Date.now()]);
        recordStmt.step();
        recordStmt.free();
        saveDb();
      }
    }
  }

  // Seed sample initial data if database is empty
  const countStmt = db.prepare("SELECT COUNT(*) AS total FROM warehouses");
  countStmt.step();
  const whCount = countStmt.getAsObject()?.total || 0;
  countStmt.free();

  if (whCount === 0) {
    console.log("Seeding initial logistics data...");
    const now = Date.now();
    const pepper = envConfig.DRIVER_PIN_PEPPER || "driver-pepper-secret-2026";
    const dummyEnv = { DRIVER_PIN_PEPPER: pepper };

    // Warehouses
    const wh1Id = "wh-merkez";
    const wh2Id = "wh-gebze";
    const wh3Id = "wh-izmir";

    db.exec(`
      INSERT INTO warehouses (id, ad, konum, kapasite, not_metni, created_at) VALUES
      ('${wh1Id}', 'Merkez Ana Depo', 'İstanbul - Tuzla Lojistik Üssü', 5000, 'Ana dağıtım ve cross-dock transfer merkezi', ${now}),
      ('${wh2Id}', 'Anadolu Bölge Deposu', 'Kocaeli - Gebze OSB', 3500, 'Soğuk hava ve kuru gıda depolama', ${now}),
      ('${wh3Id}', 'Ege Lojistik Merkezi', 'İzmir - Kemalpaşa', 2500, 'Ege ve Akdeniz dağıtım noktası', ${now});
    `);

    // Warehouse Zones
    const z1 = "zone-a1";
    const z2 = "zone-b2";
    const z3 = "zone-c3";
    const z4 = "zone-g1";
    const z5 = "zone-g2";

    db.exec(`
      INSERT INTO warehouse_zones (id, warehouse_id, kod, ad, kapasite, not_metni, created_at) VALUES
      ('${z1}', '${wh1Id}', 'A-01', 'Hızlı Sirkülasyon Alanı', 1000, 'Giriş kat rampa önü', ${now}),
      ('${z2}', '${wh1Id}', 'B-02', 'Raf Katı 1 - Kuru Gıda', 1500, 'Standart palet rafları', ${now}),
      ('${z3}', '${wh1Id}', 'C-03', 'Palet İstif Alanı', 2500, 'Yüksek hacimli blok stok', ${now}),
      ('${z4}', '${wh2Id}', 'G-01', 'Kabul ve Sevkiyat Rampası', 800, 'Geçici bekleme alanı', ${now}),
      ('${z5}', '${wh2Id}', 'G-02', 'Ana Stok Bölümü', 2700, 'Korumalı depolama', ${now});
    `);

    // Drivers
    const dr1Id = "dr-ahmet";
    const dr2Id = "dr-mehmet";
    const dr3Id = "dr-ali";
    const pinHash1 = await hashPin("1234", dummyEnv);
    const pinHash2 = await hashPin("1234", dummyEnv);
    const pinHash3 = await hashPin("1234", dummyEnv);

    db.exec(`
      INSERT INTO drivers (id, ad, kod, telefon, pin_hash, aktif, not_metni, created_at) VALUES
      ('${dr1Id}', 'Ahmet Yılmaz', 'SRV01', '0532 111 22 33', '${pinHash1}', 1, 'Kıdemli uzun yol şoförü (SRC 3/4)', ${now}),
      ('${dr2Id}', 'Mehmet Demir', 'SRV02', '0544 222 33 44', '${pinHash2}', 1, 'Şehir içi ve bölge dağıtım', ${now}),
      ('${dr3Id}', 'Ali Kaya', 'SRV03', '0555 333 44 55', '${pinHash3}', 1, 'Marmara - Ege hattı sorumlusu', ${now});
    `);

    // Vehicles
    const v1Id = "vh-101";
    const v2Id = "vh-202";
    const v3Id = "vh-303";

    db.exec(`
      INSERT INTO vehicles (id, plaka, marka_model, durum, surucu_id, not_metni, created_at) VALUES
      ('${v1Id}', '34 LOJ 101', 'Mercedes-Benz Actros 1845', 'aktif', '${dr1Id}', '2023 model çekici + treyler', ${now}),
      ('${v2Id}', '34 TRK 202', 'Ford F-Max 500', 'aktif', '${dr2Id}', '2024 model tenteli', ${now}),
      ('${v3Id}', '35 EGE 303', 'Iveco Eurocargo 160E25', 'aktif', '${dr3Id}', 'Kamyonet frigorifik', ${now});
    `);

    // Pallets & Movements
    const p1 = "plt-1001";
    const p2 = "plt-1002";
    const p3 = "plt-1003";

    db.exec(`
      INSERT INTO pallets (id, kod, warehouse_id, zone_id, urun_adi, parti_no, uretim_tarihi, miktar, birim, durum, not_metni, created_at) VALUES
      ('${p1}', 'PLT-1001', '${wh1Id}', '${z1}', 'Organik Zeytinyağı 5L', 'PRT-2026-08A', '2026-08-01', 120, 'Koli', 'depoda', 'Öncelikli FIFO sevkiyat', ${now}),
      ('${p2}', 'PLT-1002', '${wh1Id}', '${z2}', 'Doğal Çiçek Balı 850g', 'PRT-2026-07B', '2026-07-15', 80, 'Kutu', 'depoda', 'Oda sıcaklığında muhafaza', ${now}),
      ('${p3}', 'PLT-1003', '${wh2Id}', '${z4}', 'Endüstriyel Temizlik Solüsyonu', 'PRT-2026-08C', '2026-08-10', 45, 'Varil', 'depoda', 'Kimyasal depolama kuralları geçerli', ${now});

      INSERT INTO pallet_movements (id, pallet_id, tur, zone_id, miktar, tarih, not_metni, created_at) VALUES
      ('mov-1', '${p1}', 'giris', '${z1}', 120, '2026-08-01', 'İlk mal kabul girişi', ${now}),
      ('mov-2', '${p2}', 'giris', '${z2}', 80, '2026-07-15', 'İlk mal kabul girişi', ${now}),
      ('mov-3', '${p3}', 'giris', '${z4}', 45, '2026-08-10', 'İlk mal kabul girişi', ${now});
    `);

    // Shipments
    db.exec(`
      INSERT INTO shipments (id, yon, taraf_adi, taraf_telefon, barkod, urun_adi, arac_id, surucu_id, cikis_konumu, varis_konumu, planlanan_tarih, durum, not_metni, teslim_depo_id, teslim_alan_kisi, created_at) VALUES
      ('shp-1', 'giden', 'Migros Dağıtım Merkezi', '0216 555 01 01', 'SEV-2026-001', 'Organik Zeytinyağı & Bal', '${v1Id}', '${dr1Id}', 'İstanbul Tuzla Deposu', 'Şekerpınar Dağıtım Merkezi', '2026-08-20', 'yolda', 'Sabah 09:00 rampa randevusu mevcut', NULL, NULL, ${now}),
      ('shp-2', 'gelen', 'Ege Zeytincilik A.Ş.', '0232 444 11 22', 'SEV-2026-002', 'Ham Zeytinyağı Sevkiyatı', '${v3Id}', '${dr3Id}', 'Ayvalık Tesisleri', 'İstanbul Tuzla Deposu', '2026-08-21', 'planlandi', 'Kalite kontrol laboratuvar onayı sonrası mal kabul edilecek', '${wh1Id}', 'Depo Şefi Mustafa Bey', ${now});
    `);

    // Warehouse Transfers
    db.exec(`
      INSERT INTO warehouse_transfers (id, barkod, urun_adi, miktar, birim, kaynak_depo_id, hedef_depo_id, tarih, durum, not_metni, created_at) VALUES
      ('trf-1', 'TRF-2026-01', 'Doğal Çiçek Balı', 40, 'Kutu', '${wh1Id}', '${wh2Id}', '2026-08-20', 'planlandi', 'Gebze mağazaları siparişleri için stok aktarımı', ${now});
    `);

    // Driver Locations
    db.exec(`
      INSERT INTO driver_locations (id, driver_id, lat, lng, dogruluk, hiz, kaydedilen_zaman, created_at) VALUES
      ('loc-1', '${dr1Id}', 40.8872, 29.3582, 8.5, 72.0, ${now - 3 * 60 * 1000}, ${now - 3 * 60 * 1000}),
      ('loc-2', '${dr2Id}', 40.9924, 29.1245, 5.2, 45.0, ${now - 8 * 60 * 1000}, ${now - 8 * 60 * 1000}),
      ('loc-3', '${dr3Id}', 38.4192, 27.1287, 10.0, 88.0, ${now - 15 * 60 * 1000}, ${now - 15 * 60 * 1000});
    `);

    saveDb();
  }

  // Return Cloudflare D1-compatible DB object
  const d1Interface = {
    prepare(sql) {
      let boundParams = [];
      const stmtObj = {
        bind(...params) {
          boundParams = params;
          return stmtObj;
        },
        async all() {
          const stmt = db.prepare(sql);
          if (boundParams.length > 0) {
            stmt.bind(boundParams.map((v) => (v === undefined ? null : v)));
          }
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return { results };
        },
        async first(colName) {
          const stmt = db.prepare(sql);
          if (boundParams.length > 0) {
            stmt.bind(boundParams.map((v) => (v === undefined ? null : v)));
          }
          let row = null;
          if (stmt.step()) {
            row = stmt.getAsObject();
          }
          stmt.free();
          if (!row) return null;
          if (colName && typeof colName === "string") return row[colName] ?? null;
          return row;
        },
        async run() {
          const stmt = db.prepare(sql);
          if (boundParams.length > 0) {
            stmt.bind(boundParams.map((v) => (v === undefined ? null : v)));
          }
          stmt.step();
          stmt.free();
          saveDb();
          const changesRes = db.exec("SELECT changes() AS changes");
          const changes = changesRes[0]?.values[0]?.[0] || 0;
          return { success: true, meta: { changes } };
        },
        async raw() {
          const stmt = db.prepare(sql);
          if (boundParams.length > 0) {
            stmt.bind(boundParams.map((v) => (v === undefined ? null : v)));
          }
          const results = [];
          while (stmt.step()) {
            results.push(stmt.get());
          }
          stmt.free();
          return results;
        },
      };
      return stmtObj;
    },
    async batch(statements) {
      const results = [];
      db.exec("BEGIN TRANSACTION;");
      try {
        for (const s of statements) {
          const res = await s.all();
          results.push(res);
        }
        db.exec("COMMIT;");
        saveDb();
        return results;
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    },
    async exec(sql) {
      db.exec(sql);
      saveDb();
      return { count: 1 };
    },
  };

  return d1Interface;
}
