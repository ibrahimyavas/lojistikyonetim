import { json } from "./utils.js";

function productRow(row) {
  return {
    id: row.id,
    ad: row.ad,
    birim: row.birim,
    // Bu üründen standart bir palete kaç adet/birim sığdığı - PalletsDashboard
    // ürün adı girilince palet miktarını buradan otomatik öneriyor.
    paletBasinaAdet: row.palet_basina_adet,
    // Dolu bir paletin fiziksel boyutları (cm) ve ağırlığı (kg) - 3D
    // yükleme ekranının gerçek ölçülerle çalışmasına temel oluşturuyor.
    paletUzunlukCm: row.palet_uzunluk_cm,
    paletGenislikCm: row.palet_genislik_cm,
    paletYukseklikCm: row.palet_yukseklik_cm,
    paletAgirlikKg: row.palet_agirlik_kg,
    notMetni: row.not_metni,
    createdAt: row.created_at,
  };
}

function parseNumericFields(body) {
  const fields = {};
  const numericKeys = ["paletBasinaAdet", "paletUzunlukCm", "paletGenislikCm", "paletYukseklikCm", "paletAgirlikKg"];
  for (const key of numericKeys) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const raw = body[key];
    const value = raw === "" || raw == null ? null : Number(raw);
    if (value != null && !Number.isFinite(value)) {
      return { error: json({ error: `${key} geçerli bir sayı olmalı.` }, { status: 400 }) };
    }
    if (value != null && value <= 0) {
      return { error: json({ error: `${key} 0'dan büyük olmalı.` }, { status: 400 }) };
    }
    fields[key] = value;
  }
  return { fields };
}

async function listProducts(env) {
  const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY ad ASC").all();
  return json({ products: results.map(productRow) });
}

async function createProduct(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const ad = String(body.ad ?? "").trim();
  if (!ad) return json({ error: "Ürün adı zorunlu." }, { status: 400 });

  const { fields, error } = parseNumericFields(body);
  if (error) return error;

  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO products
         (id, ad, birim, palet_basina_adet, palet_uzunluk_cm, palet_genislik_cm, palet_yukseklik_cm, palet_agirlik_kg, not_metni, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
      .bind(
        id,
        ad,
        String(body.birim ?? "").trim() || null,
        fields.paletBasinaAdet ?? null,
        fields.paletUzunlukCm ?? null,
        fields.paletGenislikCm ?? null,
        fields.paletYukseklikCm ?? null,
        fields.paletAgirlikKg ?? null,
        String(body.notMetni ?? "").trim() || null,
        now
      )
      .run();
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(err?.message || "")) {
      return json({ error: "Bu isimde bir ürün zaten tanımlı." }, { status: 409 });
    }
    throw err;
  }

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateProduct(request, env, id) {
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
    if (!ad) return json({ error: "Ürün adı zorunlu." }, { status: 400 });
    sets.push(`ad = ?${idx++}`);
    values.push(ad);
  }
  if (Object.prototype.hasOwnProperty.call(body, "birim")) {
    sets.push(`birim = ?${idx++}`);
    values.push(String(body.birim ?? "").trim() || null);
  }

  const { fields, error } = parseNumericFields(body);
  if (error) return error;
  const columnByKey = {
    paletBasinaAdet: "palet_basina_adet",
    paletUzunlukCm: "palet_uzunluk_cm",
    paletGenislikCm: "palet_genislik_cm",
    paletYukseklikCm: "palet_yukseklik_cm",
    paletAgirlikKg: "palet_agirlik_kg",
  };
  for (const [key, column] of Object.entries(columnByKey)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${column} = ?${idx++}`);
      values.push(fields[key]);
    }
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
    await env.DB.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?${idx}`)
      .bind(...values)
      .run();
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(err?.message || "")) {
      return json({ error: "Bu isimde bir ürün zaten tanımlı." }, { status: 409 });
    }
    throw err;
  }

  return json({ ok: true });
}

async function deleteProduct(env, id) {
  // products hiçbir tabloya FK ile bağlı değil (pallets/shipments ürünü hâlâ
  // serbest metin `urunAdi` ile tutuyor) - silmek geçmiş palet/sevkiyat
  // kayıtlarını ETKİLEMİYOR, sadece o ürün için gelecekteki otomatik
  // öneriler durur.
  await env.DB.prepare("DELETE FROM products WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/products*. Returns a Response if it owns this route, or null
// so the caller can fall through to other route handlers.
export async function handleProductsRoute(request, env, pathname) {
  if (pathname === "/api/products") {
    if (request.method === "GET") return listProducts(env);
    if (request.method === "POST") return createProduct(request, env);
  }

  const match = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    return updateProduct(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deleteProduct(env, match[1]);
  }

  return null;
}
