import { json } from "./utils.js";
import { hashPin } from "./driverAuth.js";

// pin_hash HİÇBİR ZAMAN response'a dahil edilmiyor - admin panelinde bile
// gösterilmiyor, sadece "PIN sıfırla" akışıyla yeniden belirlenebiliyor.
function driverRow(row) {
  return {
    id: row.id,
    ad: row.ad,
    kod: row.kod,
    telefon: row.telefon,
    aktif: !!row.aktif,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

function isUniqueConstraintError(err) {
  return /UNIQUE constraint failed/i.test(err?.message || "");
}

async function listDrivers(env) {
  const { results } = await env.DB.prepare("SELECT * FROM drivers ORDER BY created_at DESC").all();
  return json({ drivers: results.map(driverRow) });
}

async function createDriver(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const ad = String(body.ad ?? "").trim();
  const kod = String(body.kod ?? "").trim();
  const pin = String(body.pin ?? "").trim();
  if (!ad) return json({ error: "Ad zorunlu." }, { status: 400 });
  if (!kod) return json({ error: "Kod zorunlu." }, { status: 400 });
  if (pin.length < 4) return json({ error: "PIN en az 4 karakter olmalı." }, { status: 400 });

  const id = crypto.randomUUID();
  const now = Date.now();
  const pinHash = await hashPin(pin, env);

  try {
    await env.DB.prepare(
      `INSERT INTO drivers (id, ad, kod, telefon, pin_hash, aktif, not_metni, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(id, ad, kod, String(body.telefon ?? "").trim() || null, pinHash, 1, String(body.notMetni ?? "").trim() || null, now)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) return json({ error: "Bu kod zaten kullanılıyor." }, { status: 409 });
    throw err;
  }

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateDriver(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const sets = [];
  const values = [];
  let idx = 1;

  if (Object.prototype.hasOwnProperty.call(body, "ad")) {
    const ad = String(body.ad ?? "").trim();
    if (!ad) return json({ error: "Ad zorunlu." }, { status: 400 });
    sets.push(`ad = ?${idx++}`);
    values.push(ad);
  }
  if (Object.prototype.hasOwnProperty.call(body, "kod")) {
    const kod = String(body.kod ?? "").trim();
    if (!kod) return json({ error: "Kod zorunlu." }, { status: 400 });
    sets.push(`kod = ?${idx++}`);
    values.push(kod);
  }
  if (Object.prototype.hasOwnProperty.call(body, "telefon")) {
    sets.push(`telefon = ?${idx++}`);
    values.push(String(body.telefon ?? "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "notMetni")) {
    sets.push(`not_metni = ?${idx++}`);
    values.push(String(body.notMetni ?? "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "aktif")) {
    sets.push(`aktif = ?${idx++}`);
    values.push(body.aktif ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(body, "pin")) {
    const pin = String(body.pin ?? "").trim();
    if (pin.length < 4) return json({ error: "PIN en az 4 karakter olmalı." }, { status: 400 });
    sets.push(`pin_hash = ?${idx++}`);
    values.push(await hashPin(pin, env));
  }

  if (sets.length === 0) {
    return json({ error: "Güncellenecek alan belirtilmedi." }, { status: 400 });
  }

  values.push(id);
  try {
    await env.DB.prepare(`UPDATE drivers SET ${sets.join(", ")} WHERE id = ?${idx}`)
      .bind(...values)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) return json({ error: "Bu kod zaten kullanılıyor." }, { status: 409 });
    throw err;
  }

  return json({ ok: true });
}

async function deleteDriver(env, id) {
  // vehicles.surucu_id ON DELETE SET NULL - bu sürücüye atanmış araçlar
  // otomatik olarak "atanmamış" durumuna düşer, ayrıca bir kontrol gerekmiyor.
  await env.DB.prepare("DELETE FROM drivers WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/drivers*. Returns a Response if it owns this route, or null
// so the caller can fall through to other route handlers.
export async function handleDriversRoute(request, env, pathname) {
  if (pathname === "/api/drivers") {
    if (request.method === "GET") return listDrivers(env);
    if (request.method === "POST") return createDriver(request, env);
  }

  const match = pathname.match(/^\/api\/drivers\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    return updateDriver(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deleteDriver(env, match[1]);
  }

  return null;
}
