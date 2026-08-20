import { json } from "./utils.js";
import { hashPassword } from "./auth.js";

const ROLES = new Set(["yonetici", "operator"]);

// sifre_hash HİÇBİR ZAMAN response'a dahil edilmiyor - admin panelinde
// bile gösterilmiyor, sadece "şifre sıfırla" akışıyla yeniden belirlenebiliyor.
function userRow(row) {
  return {
    id: row.id,
    ad: row.ad,
    kullaniciAdi: row.kullanici_adi,
    rol: row.rol,
    aktif: !!row.aktif,
    createdAt: row.created_at,
  };
}

function isUniqueConstraintError(err) {
  return /UNIQUE constraint failed/i.test(err?.message || "");
}

async function listUsers(env) {
  const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return json({ users: results.map(userRow) });
}

async function createUser(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const ad = String(body.ad ?? "").trim();
  const kullaniciAdi = String(body.kullaniciAdi ?? "").trim();
  const sifre = String(body.sifre ?? "").trim();
  const rol = ROLES.has(body.rol) ? body.rol : "operator";
  if (!ad) return json({ error: "Ad zorunlu." }, { status: 400 });
  if (!kullaniciAdi) return json({ error: "Kullanıcı adı zorunlu." }, { status: 400 });
  if (sifre.length < 4) return json({ error: "Şifre en az 4 karakter olmalı." }, { status: 400 });

  const id = crypto.randomUUID();
  const now = Date.now();
  const sifreHash = await hashPassword(sifre, env);

  try {
    await env.DB.prepare(
      `INSERT INTO users (id, ad, kullanici_adi, sifre_hash, rol, aktif, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)`
    )
      .bind(id, ad, kullaniciAdi, sifreHash, rol, now)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) return json({ error: "Bu kullanıcı adı zaten kullanılıyor." }, { status: 409 });
    throw err;
  }

  return json({ id, createdAt: now }, { status: 201 });
}

async function updateUser(request, env, id) {
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
  if (Object.prototype.hasOwnProperty.call(body, "kullaniciAdi")) {
    const kullaniciAdi = String(body.kullaniciAdi ?? "").trim();
    if (!kullaniciAdi) return json({ error: "Kullanıcı adı zorunlu." }, { status: 400 });
    sets.push(`kullanici_adi = ?${idx++}`);
    values.push(kullaniciAdi);
  }
  if (Object.prototype.hasOwnProperty.call(body, "rol")) {
    if (!ROLES.has(body.rol)) return json({ error: "Geçersiz rol." }, { status: 400 });
    sets.push(`rol = ?${idx++}`);
    values.push(body.rol);
  }
  if (Object.prototype.hasOwnProperty.call(body, "aktif")) {
    sets.push(`aktif = ?${idx++}`);
    values.push(body.aktif ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(body, "sifre")) {
    const sifre = String(body.sifre ?? "").trim();
    if (sifre.length < 4) return json({ error: "Şifre en az 4 karakter olmalı." }, { status: 400 });
    sets.push(`sifre_hash = ?${idx++}`);
    values.push(await hashPassword(sifre, env));
  }

  if (sets.length === 0) {
    return json({ error: "Güncellenecek alan belirtilmedi." }, { status: 400 });
  }

  values.push(id);
  try {
    await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?${idx}`)
      .bind(...values)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) return json({ error: "Bu kullanıcı adı zaten kullanılıyor." }, { status: 409 });
    throw err;
  }

  return json({ ok: true });
}

async function deleteUser(env, id) {
  await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Handles /api/users*. Yönetici-only (bkz. worker/index.js ROUTE_GROUPS) -
// bu dosya kendi başına rol kontrolü yapmıyor, çağrıldığında zaten
// Yönetici olduğu garanti.
export async function handleUsersRoute(request, env, pathname) {
  if (pathname === "/api/users") {
    if (request.method === "GET") return listUsers(env);
    if (request.method === "POST") return createUser(request, env);
  }

  const match = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    return updateUser(request, env, match[1]);
  }
  if (match && request.method === "DELETE") {
    return deleteUser(env, match[1]);
  }

  return null;
}
