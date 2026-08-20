import { json } from "./utils.js";

const DIRECTIONS = new Set(["giden", "gelen"]);
const STATUSES = new Set(["planlandi", "yolda", "teslim_edildi", "iptal"]);

// Şoför rolü kendi sevkiyatını güncellerken SADECE bu alanları
// değiştirebilir - taraf/araç/teslim bilgilerini yeniden atayamaz, sadece
// durumunu ilerletebilir ve not düşebilir.
const SOFOR_EDITABLE_FIELDS = new Set(["durum", "notMetni"]);

function shipmentRow(row) {
  return {
    id: row.id,
    yon: row.yon,
    tarafAdi: row.taraf_adi,
    tarafTelefon: row.taraf_telefon,
    barkod: row.barkod,
    urunAdi: row.urun_adi,
    aracId: row.arac_id,
    surucuId: row.surucu_id,
    cikisKonumu: row.cikis_konumu,
    varisKonumu: row.varis_konumu,
    planlananTarih: row.planlanan_tarih,
    gerceklesenTarih: row.gerceklesen_tarih,
    durum: row.durum,
    notMetni: row.not_metni,
    teslimDepoId: row.teslim_depo_id,
    teslimAlanKisi: row.teslim_alan_kisi,
    createdAt: row.created_at,
  };
}

// Şoför sadece KENDİ (surucu_id = session.id) sevkiyatlarını görür -
// başka bir sürücünün sevkiyatı listede/detayda hiç görünmez.
async function listShipments(env, session) {
  if (session.role === "sofor") {
    const { results } = await env.DB.prepare("SELECT * FROM shipments WHERE surucu_id = ?1 ORDER BY created_at DESC")
      .bind(session.id)
      .all();
    return json({ shipments: results.map(shipmentRow) });
  }
  const { results } = await env.DB.prepare("SELECT * FROM shipments ORDER BY created_at DESC").all();
  return json({ shipments: results.map(shipmentRow) });
}

// Tek bir sevkiyatın GÜNCEL halini döner - QR "canlı referans" modu için
// (bkz. src/lib/qrPayload.js buildRouteRef/parseRouteRef): basılan etiket
// sadece bu ID'yi taşıyor, her okutmada buraya sorulup en güncel durum/
// güzergah gösteriliyor.
async function getShipment(env, id, session) {
  const row = await env.DB.prepare("SELECT * FROM shipments WHERE id = ?1").bind(id).first();
  if (!row) return json({ error: "Sevkiyat bulunamadı." }, { status: 404 });
  if (session.role === "sofor" && row.surucu_id !== session.id) {
    return json({ error: "Bu sevkiyat size ait değil." }, { status: 403 });
  }
  return json({ shipment: shipmentRow(row) });
}

async function createShipment(request, env, session) {
  // Şoför yeni sevkiyat oluşturamaz - sadece kendisine atanmış olanları
  // yönetebilir.
  if (session.role === "sofor") {
    return json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const tarafAdi = String(body.tarafAdi ?? "").trim();
  if (!tarafAdi) return json({ error: "Taraf adı zorunlu." }, { status: 400 });

  const yon = DIRECTIONS.has(body.yon) ? body.yon : "giden";
  const durum = STATUSES.has(body.durum) ? body.durum : "planlandi";
  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO shipments
       (id, yon, taraf_adi, taraf_telefon, barkod, urun_adi, arac_id, surucu_id, cikis_konumu, varis_konumu,
        planlanan_tarih, gerceklesen_tarih, durum, not_metni, teslim_depo_id, teslim_alan_kisi, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
  )
    .bind(
      id,
      yon,
      tarafAdi,
      String(body.tarafTelefon ?? "").trim() || null,
      String(body.barkod ?? "").trim() || null,
      String(body.urunAdi ?? "").trim() || null,
      String(body.aracId ?? "").trim() || null,
      String(body.surucuId ?? "").trim() || null,
      String(body.cikisKonumu ?? "").trim() || null,
      String(body.varisKonumu ?? "").trim() || null,
      String(body.planlananTarih ?? "").trim() || null,
      String(body.gerceklesenTarih ?? "").trim() || null,
      durum,
      String(body.notMetni ?? "").trim() || null,
      String(body.teslimDepoId ?? "").trim() || null,
      String(body.teslimAlanKisi ?? "").trim() || null,
      now
    )
    .run();

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateShipment(request, env, id, session) {
  const current = await env.DB.prepare("SELECT * FROM shipments WHERE id = ?1").bind(id).first();
  if (!current) return json({ error: "Sevkiyat bulunamadı." }, { status: 404 });
  if (session.role === "sofor" && current.surucu_id !== session.id) {
    return json({ error: "Bu sevkiyat size ait değil." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (session.role === "sofor") {
    const attemptedExtra = Object.keys(body).some(
      (key) => key !== "gerceklesenTarih" && key !== "tarih" && !SOFOR_EDITABLE_FIELDS.has(key)
    );
    if (attemptedExtra) {
      return json({ error: "Sadece durum ve not güncelleyebilirsiniz." }, { status: 403 });
    }
  }

  if (body.durum != null && !STATUSES.has(body.durum)) {
    return json({ error: "Geçersiz durum." }, { status: 400 });
  }

  // Teslim edildi'ye YENİ geçişte, elle girilmediyse gerçekleşen tarihi
  // bugüne ayarla - "teslim edildi dedim ama tarihi unuttum" olmasın diye.
  // Mevcut durumu kontrol etmeden yapılırsa (eski hâl) zaten teslim edilmiş
  // bir sevkiyatın form tam gönderiminde (ör. sadece notu düzeltmek için
  // "Düzenle") her seferinde gerceklesen_tarih bugüne SIFIRLANIR - gerçek
  // teslim tarihi sessizce kaybolurdu. Sadece GERÇEK bir geçişte dolduruyoruz.
  let gerceklesenTarih = body.gerceklesenTarih;
  if (body.durum === "teslim_edildi" && !gerceklesenTarih && current.durum !== "teslim_edildi") {
    gerceklesenTarih = new Date().toISOString().slice(0, 10);
  }

  const sets = [];
  const values = [];
  let idx = 1;
  const textFields = {
    yon: "yon",
    tarafAdi: "taraf_adi",
    tarafTelefon: "taraf_telefon",
    barkod: "barkod",
    urunAdi: "urun_adi",
    aracId: "arac_id",
    surucuId: "surucu_id",
    cikisKonumu: "cikis_konumu",
    varisKonumu: "varis_konumu",
    planlananTarih: "planlanan_tarih",
    durum: "durum",
    notMetni: "not_metni",
    teslimDepoId: "teslim_depo_id",
    teslimAlanKisi: "teslim_alan_kisi",
  };
  for (const [key, column] of Object.entries(textFields)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      sets.push(`${column} = ?${idx++}`);
      values.push(String(body[key] ?? "").trim() || null);
    }
  }
  if (gerceklesenTarih !== undefined) {
    sets.push(`gerceklesen_tarih = ?${idx++}`);
    values.push(String(gerceklesenTarih ?? "").trim() || null);
  }

  if (sets.length === 0) {
    return json({ error: "Güncellenecek alan belirtilmedi." }, { status: 400 });
  }

  values.push(id);
  await env.DB.prepare(`UPDATE shipments SET ${sets.join(", ")} WHERE id = ?${idx}`)
    .bind(...values)
    .run();

  return json({ ok: true, gerceklesenTarih });
}

async function deleteShipment(env, id, session) {
  if (session.role === "sofor") {
    return json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }
  await env.DB.prepare("DELETE FROM shipments WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/shipments*. Returns a Response if it owns this route, or
// null so the caller can fall through to other route handlers. `session`
// (bkz. worker/auth.js) rol bazlı filtreleme/sahiplik kontrolü için - bu
// modül kendi kapısını kendi yönetiyor (worker/index.js'in ROUTE_GROUPS
// tablosunda YOK), çünkü Şoför erişimi "hepsi ya da hiçbiri" değil,
// "sadece kendi sevkiyatları" şeklinde satır bazlı.
export async function handleShipmentsRoute(request, env, pathname, session) {
  if (pathname === "/api/shipments") {
    if (request.method === "GET") return listShipments(env, session);
    if (request.method === "POST") return createShipment(request, env, session);
  }

  const match = pathname.match(/^\/api\/shipments\/([^/]+)$/);
  if (match && request.method === "GET") {
    return getShipment(env, match[1], session);
  }
  if (match && request.method === "PATCH") {
    return updateShipment(request, env, match[1], session);
  }
  if (match && request.method === "DELETE") {
    return deleteShipment(env, match[1], session);
  }

  return null;
}
