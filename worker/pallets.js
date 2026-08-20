import { json } from "./utils.js";

const STATUSES = new Set(["depoda", "sevk_edildi"]);

function palletRow(row) {
  return {
    id: row.id,
    kod: row.kod,
    warehouseId: row.warehouse_id,
    zoneId: row.zone_id,
    urunAdi: row.urun_adi,
    partiNo: row.parti_no,
    uretimTarihi: row.uretim_tarihi,
    miktar: row.miktar,
    birim: row.birim,
    durum: row.durum,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

function movementRow(row) {
  return {
    id: row.id,
    palletId: row.pallet_id,
    tur: row.tur,
    zoneId: row.zone_id,
    miktar: row.miktar,
    tarih: row.tarih,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

// FIFO: en eski üretim tarihi önce - parti/üretim tarihi olmayan paletler
// (uretim_tarihi NULL) en sona düşer, "hangisi öncelikli belirsiz" yerine
// "en son sırada, gerekirse bakılır" davranışı için.
async function listPallets(env) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM pallets ORDER BY (uretim_tarihi IS NULL), uretim_tarihi ASC, created_at ASC`
  ).all();
  return json({ pallets: results.map(palletRow) });
}

async function listMovements(env, palletId) {
  const { results } = await env.DB.prepare("SELECT * FROM pallet_movements WHERE pallet_id = ?1 ORDER BY created_at DESC")
    .bind(palletId)
    .all();
  return json({ movements: results.map(movementRow) });
}

// Yeni bir palet oluşturmak = MAL KABUL: her create bir 'giris' hareketi
// olarak da loglanıyor (bkz. pallet_movements) - salt-okunur denetim izi.
async function createPallet(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const urunAdi = String(body.urunAdi ?? "").trim();
  if (!urunAdi) return json({ error: "Ürün adı zorunlu." }, { status: 400 });

  const kod = String(body.kod ?? "").trim() || `PLT-${Date.now().toString(36).toUpperCase()}`;
  const miktar = body.miktar === "" || body.miktar == null ? null : Number(body.miktar);
  if (miktar != null && !Number.isFinite(miktar)) {
    return json({ error: "Miktar geçerli bir sayı olmalı." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const warehouseId = String(body.warehouseId ?? "").trim() || null;
  const zoneId = String(body.zoneId ?? "").trim() || null;

  try {
    await env.DB.prepare(
      `INSERT INTO pallets
         (id, kod, warehouse_id, zone_id, urun_adi, parti_no, uretim_tarihi, miktar, birim, durum, not_metni, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'depoda', ?10, ?11)`
    )
      .bind(
        id,
        kod,
        warehouseId,
        zoneId,
        urunAdi,
        String(body.partiNo ?? "").trim() || null,
        String(body.uretimTarihi ?? "").trim() || null,
        miktar,
        String(body.birim ?? "").trim() || null,
        String(body.notMetni ?? "").trim() || null,
        now
      )
      .run();
  } catch (err) {
    if (/FOREIGN KEY constraint failed/i.test(err?.message || "")) {
      return json({ error: "Seçilen depo/bölüm bulunamadı." }, { status: 400 });
    }
    throw err;
  }

  await env.DB.prepare(
    `INSERT INTO pallet_movements (id, pallet_id, tur, zone_id, miktar, tarih, not_metni, created_at)
     VALUES (?1, ?2, 'giris', ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(crypto.randomUUID(), id, zoneId, miktar, String(body.tarih ?? "").trim() || null, "Mal kabul", now)
    .run();

  return json({ id, kod, createdAt: now }, { status: 201 });
}

// Bir paleti günceller - durum 'sevk_edildi'ye değişirse (MAL ÇIKIŞ) ya da
// zone_id değişirse (bölüm transferi) otomatik olarak pallet_movements'a
// bir hareket kaydı ekler.
async function updatePallet(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (body.durum != null && !STATUSES.has(body.durum)) {
    return json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const current = await env.DB.prepare("SELECT * FROM pallets WHERE id = ?1").bind(id).first();
  if (!current) return json({ error: "Palet bulunamadı." }, { status: 404 });

  const sets = [];
  const values = [];
  let idx = 1;
  const textFields = {
    kod: "kod",
    warehouseId: "warehouse_id",
    zoneId: "zone_id",
    urunAdi: "urun_adi",
    partiNo: "parti_no",
    uretimTarihi: "uretim_tarihi",
    birim: "birim",
    durum: "durum",
    notMetni: "not_metni",
  };
  for (const [key, column] of Object.entries(textFields)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      sets.push(`${column} = ?${idx++}`);
      values.push(String(body[key] ?? "").trim() || null);
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "miktar")) {
    const miktar = body.miktar === "" || body.miktar == null ? null : Number(body.miktar);
    if (miktar != null && !Number.isFinite(miktar)) {
      return json({ error: "Miktar geçerli bir sayı olmalı." }, { status: 400 });
    }
    sets.push(`miktar = ?${idx++}`);
    values.push(miktar);
  }

  if (sets.length === 0) {
    return json({ error: "Güncellenecek alan belirtilmedi." }, { status: 400 });
  }

  values.push(id);
  try {
    await env.DB.prepare(`UPDATE pallets SET ${sets.join(", ")} WHERE id = ?${idx}`)
      .bind(...values)
      .run();
  } catch (err) {
    if (/FOREIGN KEY constraint failed/i.test(err?.message || "")) {
      return json({ error: "Seçilen depo/bölüm bulunamadı." }, { status: 400 });
    }
    throw err;
  }

  const now = Date.now();
  const tarih = String(body.tarih ?? "").trim() || null;
  if (Object.prototype.hasOwnProperty.call(body, "durum") && body.durum === "sevk_edildi" && current.durum !== "sevk_edildi") {
    await env.DB.prepare(
      `INSERT INTO pallet_movements (id, pallet_id, tur, zone_id, miktar, tarih, not_metni, created_at)
       VALUES (?1, ?2, 'cikis', ?3, ?4, ?5, ?6, ?7)`
    )
      .bind(crypto.randomUUID(), id, current.zone_id, current.miktar, tarih, "Mal çıkış", now)
      .run();
  } else if (Object.prototype.hasOwnProperty.call(body, "zoneId")) {
    const newZoneId = String(body.zoneId ?? "").trim() || null;
    if (newZoneId !== current.zone_id) {
      await env.DB.prepare(
        `INSERT INTO pallet_movements (id, pallet_id, tur, zone_id, miktar, tarih, not_metni, created_at)
         VALUES (?1, ?2, 'transfer', ?3, ?4, ?5, ?6, ?7)`
      )
        .bind(crypto.randomUUID(), id, newZoneId, current.miktar, tarih, "Bölüm değişikliği", now)
        .run();
    }
  }

  return json({ ok: true });
}

async function deletePallet(env, id) {
  // pallet_movements ON DELETE CASCADE - hareket geçmişi paletle birlikte
  // temizlenir.
  await env.DB.prepare("DELETE FROM pallets WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/pallets*. Returns a Response if it owns this route, or null
// so the caller can fall through to other route handlers.
export async function handlePalletsRoute(request, env, pathname) {
  if (pathname === "/api/pallets") {
    if (request.method === "GET") return listPallets(env);
    if (request.method === "POST") return createPallet(request, env);
  }

  const movementsMatch = pathname.match(/^\/api\/pallets\/([^/]+)\/movements$/);
  if (movementsMatch && request.method === "GET") {
    return listMovements(env, movementsMatch[1]);
  }

  const match = pathname.match(/^\/api\/pallets\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    return updatePallet(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deletePallet(env, match[1]);
  }

  return null;
}
