import { json } from "./utils.js";

const STATUSES = new Set(["planlandi", "tamamlandi"]);

function transferRow(row) {
  return {
    id: row.id,
    barkod: row.barkod,
    urunAdi: row.urun_adi,
    miktar: row.miktar,
    birim: row.birim,
    kaynakDepoId: row.kaynak_depo_id,
    hedefDepoId: row.hedef_depo_id,
    tarih: row.tarih,
    durum: row.durum,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

async function listTransfers(env) {
  const { results } = await env.DB.prepare("SELECT * FROM warehouse_transfers ORDER BY created_at DESC").all();
  return json({ transfers: results.map(transferRow) });
}

// QR "canlı referans" modu için tek transferin GÜNCEL hali - bkz.
// worker/shipments.js:getShipment ile aynı mantık.
async function getTransfer(env, id) {
  const row = await env.DB.prepare("SELECT * FROM warehouse_transfers WHERE id = ?1").bind(id).first();
  if (!row) return json({ error: "Transfer bulunamadı." }, { status: 404 });
  return json({ transfer: transferRow(row) });
}

async function createTransfer(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const urunAdi = String(body.urunAdi ?? "").trim();
  const kaynakDepoId = String(body.kaynakDepoId ?? "").trim();
  const hedefDepoId = String(body.hedefDepoId ?? "").trim();
  if (!urunAdi) return json({ error: "Ürün adı zorunlu." }, { status: 400 });
  if (!kaynakDepoId) return json({ error: "Kaynak depo zorunlu." }, { status: 400 });
  if (!hedefDepoId) return json({ error: "Hedef depo zorunlu." }, { status: 400 });
  if (kaynakDepoId === hedefDepoId) {
    return json({ error: "Kaynak ve hedef depo aynı olamaz." }, { status: 400 });
  }

  const miktar = body.miktar === "" || body.miktar == null ? null : Number(body.miktar);
  if (miktar != null && !Number.isFinite(miktar)) {
    return json({ error: "Miktar geçerli bir sayı olmalı." }, { status: 400 });
  }

  const durum = STATUSES.has(body.durum) ? body.durum : "planlandi";
  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO warehouse_transfers
         (id, barkod, urun_adi, miktar, birim, kaynak_depo_id, hedef_depo_id, tarih, durum, not_metni, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
      .bind(
        id,
        String(body.barkod ?? "").trim() || null,
        urunAdi,
        miktar,
        String(body.birim ?? "").trim() || null,
        kaynakDepoId,
        hedefDepoId,
        String(body.tarih ?? "").trim() || null,
        durum,
        String(body.notMetni ?? "").trim() || null,
        now
      )
      .run();
  } catch (err) {
    if (/FOREIGN KEY constraint failed/i.test(err?.message || "")) {
      return json({ error: "Seçilen depo bulunamadı." }, { status: 400 });
    }
    throw err;
  }

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateTransfer(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (body.durum != null && !STATUSES.has(body.durum)) {
    return json({ error: "Geçersiz durum." }, { status: 400 });
  }
  if (body.kaynakDepoId != null && body.hedefDepoId != null && body.kaynakDepoId === body.hedefDepoId) {
    return json({ error: "Kaynak ve hedef depo aynı olamaz." }, { status: 400 });
  }

  const sets = [];
  const values = [];
  let idx = 1;
  const textFields = {
    barkod: "barkod",
    urunAdi: "urun_adi",
    birim: "birim",
    kaynakDepoId: "kaynak_depo_id",
    hedefDepoId: "hedef_depo_id",
    tarih: "tarih",
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
    await env.DB.prepare(`UPDATE warehouse_transfers SET ${sets.join(", ")} WHERE id = ?${idx}`)
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

async function deleteTransfer(env, id) {
  await env.DB.prepare("DELETE FROM warehouse_transfers WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/warehouse-transfers*. Returns a Response if it owns this
// route, or null so the caller can fall through to other route handlers.
export async function handleWarehouseTransfersRoute(request, env, pathname) {
  if (pathname === "/api/warehouse-transfers") {
    if (request.method === "GET") return listTransfers(env);
    if (request.method === "POST") return createTransfer(request, env);
  }

  const match = pathname.match(/^\/api\/warehouse-transfers\/([^/]+)$/);
  if (match && request.method === "GET") {
    return getTransfer(env, match[1]);
  }
  if (match && request.method === "PATCH") {
    return updateTransfer(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deleteTransfer(env, match[1]);
  }

  return null;
}
