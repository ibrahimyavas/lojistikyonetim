import { json } from "./utils.js";

// Optimized Routes Handlers
export async function listOptimizedRoutes(env) {
  const { results: routes } = await env.DB.prepare(
    "SELECT * FROM optimized_routes ORDER BY created_at DESC"
  ).all();

  const { results: waypoints } = await env.DB.prepare(
    "SELECT * FROM route_waypoints ORDER BY route_id, sira_no ASC"
  ).all();

  const waypointsByRoute = {};
  waypoints.forEach((wp) => {
    if (!waypointsByRoute[wp.route_id]) waypointsByRoute[wp.route_id] = [];
    waypointsByRoute[wp.route_id].push({
      id: wp.id,
      routeId: wp.route_id,
      siraNo: wp.sira_no,
      tur: wp.tur,
      adresBaslik: wp.adres_baslik,
      lat: wp.lat,
      lng: wp.lng,
      ilgiliKisi: wp.ilgili_kisi,
      telefon: wp.telefon,
      paketAdedi: wp.paket_adedi,
      agirlikKg: wp.agirlik_kg,
      hacimM3: wp.hacim_m3,
      durum: wp.durum,
      shipmentId: wp.shipment_id,
      createdAt: wp.created_at
    });
  });

  const formattedRoutes = routes.map((r) => ({
    id: r.id,
    ad: r.ad,
    aracId: r.arac_id,
    surucuId: r.surucu_id,
    baslangicDepoId: r.baslangic_depo_id,
    toplamMesafeKm: r.toplam_mesafe_km,
    tahminiSureDk: r.tahmini_sure_dk,
    tahminiYakitLitre: r.tahmini_yakit_litre,
    karbonEmisyonKg: r.karbon_emisyon_kg,
    toplamAgirlikKg: r.toplam_agirlik_kg,
    durakSayisi: r.durak_sayisi,
    durum: r.durum,
    rotaGeometrisi: r.rota_geometrisi ? JSON.parse(r.rota_geometrisi) : [],
    waypoints: waypointsByRoute[r.id] || [],
    createdAt: r.created_at
  }));

  return json({ routes: formattedRoutes });
}

export async function createOptimizedRoute(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz JSON verisi." }, { status: 400 });
  }

  const ad = String(body.ad || "").trim() || `Rota - ${new Date().toLocaleDateString("tr-TR")}`;
  const id = crypto.randomUUID();
  const now = Date.now();

  const waypoints = Array.isArray(body.waypoints) ? body.waypoints : [];

  await env.DB.prepare(
    `INSERT INTO optimized_routes (
      id, ad, arac_id, surucu_id, baslangic_depo_id,
      toplam_mesafe_km, tahmini_sure_dk, tahmini_yakit_litre,
      karbon_emisyon_kg, toplam_agirlik_kg, durak_sayisi,
      durum, rota_geometrisi, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
  ).bind(
    id,
    ad,
    body.aracId || null,
    body.surucuId || null,
    body.baslangicDepoId || null,
    Number(body.toplamMesafeKm) || 0,
    Number(body.tahminiSureDk) || 0,
    Number(body.tahminiYakitLitre) || 0,
    Number(body.karbonEmisyonKg) || 0,
    Number(body.toplamAgirlikKg) || 0,
    waypoints.length,
    body.durum || "taslak",
    JSON.stringify(body.rotaGeometrisi || []),
    now
  ).run();

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const wpId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO route_waypoints (
        id, route_id, sira_no, tur, adres_baslik,
        lat, lng, ilgili_kisi, telefon, paket_adedi,
        agirlik_kg, hacim_m3, durum, shipment_id, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
    ).bind(
      wpId,
      id,
      i + 1,
      wp.tur || "teslimat",
      wp.adresBaslik || `Durak ${i + 1}`,
      Number(wp.lat) || 0,
      Number(wp.lng) || 0,
      wp.ilgiliKisi || null,
      wp.telefon || null,
      Number(wp.paketAdedi) || 1,
      Number(wp.agirlikKg) || 0,
      Number(wp.hacimM3) || 0,
      wp.durum || "bekliyor",
      wp.shipmentId || null,
      now
    ).run();
  }

  return json({ success: true, id, message: "Optimize edilmiş rota kaydedildi." });
}

export async function deleteOptimizedRoute(env, id) {
  await env.DB.prepare("DELETE FROM route_waypoints WHERE route_id = ?1").bind(id).run();
  await env.DB.prepare("DELETE FROM optimized_routes WHERE id = ?1").bind(id).run();
  return json({ success: true });
}

// 3D Packing Plans Handlers
export async function listPackingPlans(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM packing_plans ORDER BY created_at DESC"
  ).all();

  const formatted = results.map((r) => ({
    id: r.id,
    baslik: r.baslik,
    konteynerTipi: r.konteyner_tipi,
    konteynerU: r.konteyner_u,
    konteynerG: r.konteyner_g,
    konteynerY: r.konteyner_y,
    maksAgirlikKg: r.maks_agirlik_kg,
    toplamKoliSayisi: r.toplam_koli_sayisi,
    toplamAgirlikKg: r.toplam_agirlik_kg,
    hacimDolulukOrani: r.hacim_doluluk_orani,
    agirlikMerkezi: {
      x: r.agirlik_merkezi_x,
      y: r.agirlik_merkezi_y,
      z: r.agirlik_merkezi_z
    },
    koliVerileri: r.koli_verileri_json ? JSON.parse(r.koli_verileri_json) : [],
    createdAt: r.created_at
  }));

  return json({ packingPlans: formatted });
}

export async function createPackingPlan(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz JSON verisi." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO packing_plans (
      id, baslik, konteyner_tipi, konteyner_u, konteyner_g, konteyner_y,
      maks_agirlik_kg, toplam_koli_sayisi, toplam_agirlik_kg,
      hacim_doluluk_orani, agirlik_merkezi_x, agirlik_merkezi_y, agirlik_merkezi_z,
      koli_verileri_json, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
  ).bind(
    id,
    body.baslik || `3D Yükleme Planı - ${new Date().toLocaleDateString("tr-TR")}`,
    body.konteynerTipi || "standart_tir",
    Number(body.konteynerU) || 1360,
    Number(body.konteynerG) || 245,
    Number(body.konteynerY) || 260,
    Number(body.maksAgirlikKg) || 24000,
    Number(body.toplamKoliSayisi) || 0,
    Number(body.toplamAgirlikKg) || 0,
    Number(body.hacimDolulukOrani) || 0,
    Number(body.agirlikMerkezi?.x) || 0,
    Number(body.agirlikMerkezi?.y) || 0,
    Number(body.agirlikMerkezi?.z) || 0,
    JSON.stringify(body.koliVerileri || []),
    now
  ).run();

  return json({ success: true, id });
}

export async function deletePackingPlan(env, id) {
  await env.DB.prepare("DELETE FROM packing_plans WHERE id = ?1").bind(id).run();
  return json({ success: true });
}

// Proof of Delivery (e-POD)
// `session` (bkz. worker/auth.js) Şoför rolü için sahiplik kontrolü
// yapıyor - kendi sevkiyatı olmayan bir e-POD'a erişemez/gönderemez.
async function assertShipmentOwnership(env, shipmentId, session) {
  if (session.role !== "sofor") return null;
  const shipment = await env.DB.prepare("SELECT surucu_id FROM shipments WHERE id = ?1").bind(shipmentId).first();
  if (!shipment || shipment.surucu_id !== session.id) {
    return json({ error: "Bu sevkiyat size ait değil." }, { status: 403 });
  }
  return null;
}

export async function getProofOfDelivery(env, shipmentId, session) {
  const ownershipError = await assertShipmentOwnership(env, shipmentId, session);
  if (ownershipError) return ownershipError;

  const row = await env.DB.prepare(
    "SELECT * FROM proof_of_deliveries WHERE shipment_id = ?1 ORDER BY created_at DESC"
  ).bind(shipmentId).first();

  if (!row) {
    return json({ exists: false, pod: null });
  }

  return json({
    exists: true,
    pod: {
      id: row.id,
      shipmentId: row.shipment_id,
      aliciAdSoyad: row.alici_ad_soyad,
      aliciTelefon: row.alici_telefon,
      aliciTcVeyaUnvan: row.alici_tc_veya_unvan,
      imzaBase64: row.imza_base64,
      teslimFotografiUrl: row.teslim_fotografi_url,
      teslimLat: row.teslim_lat,
      teslimLng: row.teslim_lng,
      notlar: row.notlar,
      createdAt: row.created_at
    }
  });
}

export async function submitProofOfDelivery(request, env, session) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (!body.shipmentId) {
    return json({ error: "Sevkiyat ID zorunludur." }, { status: 400 });
  }

  const ownershipError = await assertShipmentOwnership(env, body.shipmentId, session);
  if (ownershipError) return ownershipError;

  if (!body.aliciAdSoyad) {
    return json({ error: "Teslim alan ad soyad zorunludur." }, { status: 400 });
  }
  if (!body.imzaBase64) {
    return json({ error: "Dijital imza zorunludur." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const dateStr = new Date().toISOString().split("T")[0];

  // POD kaydı ekle
  await env.DB.prepare(
    `INSERT INTO proof_of_deliveries (
      id, shipment_id, alici_ad_soyad, alici_telefon, alici_tc_veya_unvan,
      imza_base64, teslim_fotografi_url, teslim_lat, teslim_lng, notlar, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  ).bind(
    id,
    body.shipmentId,
    body.aliciAdSoyad,
    body.aliciTelefon || null,
    body.aliciTcVeyaUnvan || null,
    body.imzaBase64,
    body.teslimFotografiUrl || null,
    Number(body.teslimLat) || null,
    Number(body.teslimLng) || null,
    body.notlar || null,
    now
  ).run();

  // Sevkiyat durumunu otomatik olarak 'teslim_edildi' yap ve gerçekleşen tarihi kaydet
  await env.DB.prepare(
    `UPDATE shipments SET durum = 'teslim_edildi', gerceklesen_tarih = ?1, teslim_alan_kisi = ?2 WHERE id = ?3`
  ).bind(dateStr, body.aliciAdSoyad, body.shipmentId).run();

  return json({
    success: true,
    id,
    message: "Dijital teslim kanıtı (e-POD) başarıyla oluşturuldu ve sevkiyat tamamlandı."
  });
}
