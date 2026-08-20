import { json } from "./utils.js";

function zoneRow(row) {
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    kod: row.kod,
    ad: row.ad,
    kapasite: row.kapasite,
    // A/B/C hız sınıfı (bkz. migrations/0007_zone_sinif.sql) - null olabilir,
    // henüz sınıflandırılmamış demektir.
    sinif: row.sinif,
    // Depoda (durum='depoda') olan ve bu bölüme yerleştirilmiş PALET SAYISI
    // (miktar toplamı DEĞİL - paletlerin miktar/birim'i karışık olabilir,
    // ör. bir palet 50 kg bir palet 30 adet, toplamak anlamsız bir sayı
    // üretirdi; bir bölümün fiziksel kapasitesi kaç palet SIĞDIĞIdır).
    // AYRI bir sayaç sütunu YOK, her zaman pallets'tan CANLI hesaplanıyor
    // ki iki tablo birbirinden asenkron sapmasın.
    doluluk: row.doluluk,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

async function listZones(env) {
  const { results } = await env.DB.prepare(
    `SELECT z.*,
            (SELECT COUNT(*) FROM pallets p WHERE p.zone_id = z.id AND p.durum = 'depoda') AS doluluk
       FROM warehouse_zones z
      ORDER BY z.created_at DESC`
  ).all();
  return json({ zones: results.map(zoneRow) });
}

async function createZone(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const warehouseId = String(body.warehouseId ?? "").trim();
  const kod = String(body.kod ?? "").trim();
  if (!warehouseId) return json({ error: "Depo zorunlu." }, { status: 400 });
  if (!kod) return json({ error: "Bölüm kodu zorunlu." }, { status: 400 });

  const kapasite = body.kapasite === "" || body.kapasite == null ? null : Number(body.kapasite);
  if (kapasite != null && !Number.isFinite(kapasite)) {
    return json({ error: "Kapasite geçerli bir sayı olmalı." }, { status: 400 });
  }

  const sinif = String(body.sinif ?? "").trim().toUpperCase() || null;
  if (sinif != null && !["A", "B", "C"].includes(sinif)) {
    return json({ error: "Sınıf A, B ya da C olmalı." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO warehouse_zones (id, warehouse_id, kod, ad, kapasite, sinif, not_metni, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(id, warehouseId, kod, String(body.ad ?? "").trim() || null, kapasite, sinif, String(body.notMetni ?? "").trim() || null, now)
      .run();
  } catch (err) {
    if (/FOREIGN KEY constraint failed/i.test(err?.message || "")) {
      return json({ error: "Seçilen depo bulunamadı." }, { status: 400 });
    }
    throw err;
  }

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateZone(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const sets = [];
  const values = [];
  let idx = 1;

  if (Object.prototype.hasOwnProperty.call(body, "warehouseId")) {
    const warehouseId = String(body.warehouseId ?? "").trim();
    if (!warehouseId) return json({ error: "Depo zorunlu." }, { status: 400 });
    sets.push(`warehouse_id = ?${idx++}`);
    values.push(warehouseId);
  }
  if (Object.prototype.hasOwnProperty.call(body, "kod")) {
    const kod = String(body.kod ?? "").trim();
    if (!kod) return json({ error: "Bölüm kodu zorunlu." }, { status: 400 });
    sets.push(`kod = ?${idx++}`);
    values.push(kod);
  }
  if (Object.prototype.hasOwnProperty.call(body, "ad")) {
    sets.push(`ad = ?${idx++}`);
    values.push(String(body.ad ?? "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "kapasite")) {
    const kapasite = body.kapasite === "" || body.kapasite == null ? null : Number(body.kapasite);
    if (kapasite != null && !Number.isFinite(kapasite)) {
      return json({ error: "Kapasite geçerli bir sayı olmalı." }, { status: 400 });
    }
    sets.push(`kapasite = ?${idx++}`);
    values.push(kapasite);
  }
  if (Object.prototype.hasOwnProperty.call(body, "sinif")) {
    const sinif = String(body.sinif ?? "").trim().toUpperCase() || null;
    if (sinif != null && !["A", "B", "C"].includes(sinif)) {
      return json({ error: "Sınıf A, B ya da C olmalı." }, { status: 400 });
    }
    sets.push(`sinif = ?${idx++}`);
    values.push(sinif);
  }
  if (Object.prototype.hasOwnProperty.call(body, "notMetni")) {
    sets.push(`not_metni = ?${idx++}`);
    values.push(String(body.notMetni ?? "").trim() || null);
  }

  if (sets.length === 0) {
    return json({ error: "Güncellenecek alan belirtilmedi." }, { status: 400 });
  }

  values.push(id);
  try {
    await env.DB.prepare(`UPDATE warehouse_zones SET ${sets.join(", ")} WHERE id = ?${idx}`)
      .bind(...values)
      .run();
  } catch (err) {
    if (/FOREIGN KEY constraint failed/i.test(err?.message || "")) {
      return json({ error: "Seçilen depo bulunamadı." }, { status: 400 });
    }
    throw err;
  }

  return json({ ok: true });
}

async function deleteZone(env, id) {
  await env.DB.prepare("DELETE FROM warehouse_zones WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/warehouse-zones*. Returns a Response if it owns this route,
// or null so the caller can fall through to other route handlers.
export async function handleWarehouseZonesRoute(request, env, pathname) {
  if (pathname === "/api/warehouse-zones") {
    if (request.method === "GET") return listZones(env);
    if (request.method === "POST") return createZone(request, env);
  }

  const match = pathname.match(/^\/api\/warehouse-zones\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    return updateZone(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deleteZone(env, match[1]);
  }

  return null;
}
