import { json } from "./utils.js";

const DURUM_VALUES = new Set(["aktif", "bakimda", "pasif"]);

function vehicleRow(row) {
  return {
    id: row.id,
    plaka: row.plaka,
    markaModel: row.marka_model,
    durum: row.durum,
    surucuId: row.surucu_id,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

async function listVehicles(env) {
  const { results } = await env.DB.prepare("SELECT * FROM vehicles ORDER BY created_at DESC").all();
  return json({ vehicles: results.map(vehicleRow) });
}

async function createVehicle(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const plaka = String(body.plaka ?? "").trim();
  if (!plaka) return json({ error: "Plaka zorunlu." }, { status: 400 });

  const durum = DURUM_VALUES.has(body.durum) ? body.durum : "aktif";
  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO vehicles (id, plaka, marka_model, durum, surucu_id, not_metni, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(
      id,
      plaka,
      String(body.markaModel ?? "").trim() || null,
      durum,
      String(body.surucuId ?? "").trim() || null,
      String(body.notMetni ?? "").trim() || null,
      now
    )
    .run();

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateVehicle(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (body.durum != null && !DURUM_VALUES.has(body.durum)) {
    return json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const sets = [];
  const values = [];
  let idx = 1;

  if (Object.prototype.hasOwnProperty.call(body, "plaka")) {
    const plaka = String(body.plaka ?? "").trim();
    if (!plaka) return json({ error: "Plaka zorunlu." }, { status: 400 });
    sets.push(`plaka = ?${idx++}`);
    values.push(plaka);
  }
  if (Object.prototype.hasOwnProperty.call(body, "markaModel")) {
    sets.push(`marka_model = ?${idx++}`);
    values.push(String(body.markaModel ?? "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "durum")) {
    sets.push(`durum = ?${idx++}`);
    values.push(body.durum);
  }
  if (Object.prototype.hasOwnProperty.call(body, "surucuId")) {
    sets.push(`surucu_id = ?${idx++}`);
    values.push(String(body.surucuId ?? "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "notMetni")) {
    sets.push(`not_metni = ?${idx++}`);
    values.push(String(body.notMetni ?? "").trim() || null);
  }

  if (sets.length === 0) {
    return json({ error: "Güncellenecek alan belirtilmedi." }, { status: 400 });
  }

  values.push(id);
  await env.DB.prepare(`UPDATE vehicles SET ${sets.join(", ")} WHERE id = ?${idx}`)
    .bind(...values)
    .run();

  return json({ ok: true });
}

async function deleteVehicle(env, id) {
  await env.DB.prepare("DELETE FROM vehicles WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/vehicles*. Returns a Response if it owns this route, or null
// so the caller can fall through to other route handlers.
export async function handleVehiclesRoute(request, env, pathname) {
  if (pathname === "/api/vehicles") {
    if (request.method === "GET") return listVehicles(env);
    if (request.method === "POST") return createVehicle(request, env);
  }

  const match = pathname.match(/^\/api\/vehicles\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    return updateVehicle(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deleteVehicle(env, match[1]);
  }

  return null;
}
