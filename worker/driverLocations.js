import { json } from "./utils.js";
import { requireDriverAuth } from "./driverAuth.js";

function locationRow(row) {
  return {
    id: row.id,
    driverId: row.driver_id,
    lat: row.lat,
    lng: row.lng,
    dogruluk: row.dogruluk,
    hiz: row.hiz,
    kaydedilenZaman: row.kaydedilen_zaman,
    createdAt: row.created_at,
  };
}

// Sürücü app'inin konum bildirme uç noktası - requireDriverAuth kullanan
// İLK gerçek uç nokta (bkz. driverAuth.js). Sürücü SADECE kendi konumunu
// bildirebilir - body'de driverId YOK, Bearer token'dan çözülüyor, bir
// sürücü başka bir sürücü adına sahte konum gönderemesin diye.
async function reportLocation(request, env) {
  const { driverId, error } = await requireDriverAuth(request, env);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "Geçerli lat/lng zorunlu." }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: "lat/lng sınırların dışında." }, { status: 400 });
  }

  const dogruluk = body.dogruluk === "" || body.dogruluk == null ? null : Number(body.dogruluk);
  const hiz = body.hiz === "" || body.hiz == null ? null : Number(body.hiz);
  const kaydedilenZaman = body.kaydedilenZaman == null ? null : Number(body.kaydedilenZaman);

  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO driver_locations (id, driver_id, lat, lng, dogruluk, hiz, kaydedilen_zaman, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(id, driverId, lat, lng, dogruluk, hiz, kaydedilenZaman, now)
      .run();
  } catch (err) {
    // Token hâlâ geçerli (30 gün) ama sürücü kaydı bu arada silinmiş olabilir
    // - stateless token tasarımı gereği requireDriverAuth bunu KONTROL
    // ETMİYOR, burada FK hatası olarak ortaya çıkıyor.
    if (/FOREIGN KEY constraint failed/i.test(err?.message || "")) {
      return json({ error: "Sürücü kaydı bulunamadı - tekrar giriş yapın." }, { status: 401 });
    }
    throw err;
  }

  return json({ ok: true, id, createdAt: now }, { status: 201 });
}

// Admin panelinin "her sürücünün son konumu" listesi - her sürücü için en
// güncel kaydı döner. Hiç konum bildirmemiş sürücüler listede hiç
// görünmez (JOIN drivers ON dl.driver_id ile eşleşen kaydı olmayanlar
// otomatik dışarıda kalıyor).
async function listLastLocations(env) {
  const { results } = await env.DB.prepare(
    `SELECT dl.*, d.ad AS driver_ad, d.kod AS driver_kod
       FROM driver_locations dl
       JOIN drivers d ON d.id = dl.driver_id
      WHERE dl.created_at = (SELECT MAX(created_at) FROM driver_locations WHERE driver_id = dl.driver_id)
      ORDER BY dl.created_at DESC`
  ).all();
  return json({
    locations: results.map((row) => ({ ...locationRow(row), driverAd: row.driver_ad, driverKod: row.driver_kod })),
  });
}

// Bir sürücünün son konum geçmişi - admin panelinde "Geçmiş" detayı için.
async function listHistory(env, driverId) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM driver_locations WHERE driver_id = ?1 ORDER BY created_at DESC LIMIT 200"
  )
    .bind(driverId)
    .all();
  return json({ locations: results.map(locationRow) });
}

// Handles /api/driver/location (POST) - sürücü app'inin KENDİ Bearer
// token'ıyla konum bildirdiği uç nokta. Admin cookie oturumu GEREKMİYOR -
// worker/index.js'te requireAuth'tan ÖNCE çağrılıyor, handleDriverAuthRoute
// ile aynı sırada.
export async function handleDriverLocationsRoute(request, env, pathname) {
  if (pathname === "/api/driver/location" && request.method === "POST") {
    return reportLocation(request, env);
  }
  return null;
}

// Handles /api/driver-locations* - admin panelinin (cookie auth) konum
// görüntüleme uç noktaları, diğer admin route'larıyla aynı yerde
// (requireAuth'tan SONRA) kayıtlı.
export async function handleAdminLocationsRoute(request, env, pathname) {
  if (pathname === "/api/driver-locations" && request.method === "GET") {
    return listLastLocations(env);
  }
  const match = pathname.match(/^\/api\/driver-locations\/([^/]+)\/history$/);
  if (match && request.method === "GET") {
    return listHistory(env, match[1]);
  }
  return null;
}
