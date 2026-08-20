import { json } from "./utils.js";

function warehouseRow(row) {
  return {
    id: row.id,
    ad: row.ad,
    konum: row.konum,
    kapasite: row.kapasite,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

async function listWarehouses(env) {
  const { results } = await env.DB.prepare("SELECT * FROM warehouses ORDER BY created_at DESC").all();
  return json({ warehouses: results.map(warehouseRow) });
}

async function createWarehouse(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const ad = String(body.ad ?? "").trim();
  if (!ad) return json({ error: "Ad zorunlu." }, { status: 400 });

  const kapasite = body.kapasite === "" || body.kapasite == null ? null : Number(body.kapasite);
  if (kapasite != null && !Number.isFinite(kapasite)) {
    return json({ error: "Kapasite geçerli bir sayı olmalı." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO warehouses (id, ad, konum, kapasite, not_metni, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  )
    .bind(id, ad, String(body.konum ?? "").trim() || null, kapasite, String(body.notMetni ?? "").trim() || null, now)
    .run();

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateWarehouse(request, env, id) {
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
  if (Object.prototype.hasOwnProperty.call(body, "konum")) {
    sets.push(`konum = ?${idx++}`);
    values.push(String(body.konum ?? "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "kapasite")) {
    const kapasite = body.kapasite === "" || body.kapasite == null ? null : Number(body.kapasite);
    if (kapasite != null && !Number.isFinite(kapasite)) {
      return json({ error: "Kapasite geçerli bir sayı olmalı." }, { status: 400 });
    }
    sets.push(`kapasite = ?${idx++}`);
    values.push(kapasite);
  }
  if (Object.prototype.hasOwnProperty.call(body, "notMetni")) {
    sets.push(`not_metni = ?${idx++}`);
    values.push(String(body.notMetni ?? "").trim() || null);
  }

  if (sets.length === 0) {
    return json({ error: "Güncellenecek alan belirtilmedi." }, { status: 400 });
  }

  values.push(id);
  await env.DB.prepare(`UPDATE warehouses SET ${sets.join(", ")} WHERE id = ?${idx}`)
    .bind(...values)
    .run();

  return json({ ok: true });
}

async function deleteWarehouse(env, id) {
  await env.DB.prepare("DELETE FROM warehouses WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/warehouses*. Returns a Response if it owns this route, or
// null so the caller can fall through to other route handlers.
export async function handleWarehousesRoute(request, env, pathname) {
  if (pathname === "/api/warehouses") {
    if (request.method === "GET") return listWarehouses(env);
    if (request.method === "POST") return createWarehouse(request, env);
  }

  const match = pathname.match(/^\/api\/warehouses\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    return updateWarehouse(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deleteWarehouse(env, match[1]);
  }

  return null;
}
