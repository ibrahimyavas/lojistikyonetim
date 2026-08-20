// Web paneli kimlik doğrulaması - artık ÜÇ giriş yolu tek bir
// `/api/auth/login` uç noktasından çözülüyor, hepsi AYNI cookie oturumunu
// (rol taşıyan) üretiyor:
//   1. Kullanıcı adı BOŞ + şifre AUTH_PASSWORD'e eşit -> "ana şifre" (eski
//      davranış, DEĞİŞMEDİ) - rol: yonetici, id: yok. Bootstrap/kurtarma
//      yolu: users tablosu boşken bile her zaman girilebilir.
//   2. Kullanıcı adı `users.kullanici_adi` ile eşleşiyor -> şifre hash'i
//      kontrol edilir, rol o kayıttan gelir (yonetici | operator).
//   3. Kullanıcı adı `drivers.kod` ile eşleşiyor -> "şifre" alanı aslında
//      PIN'dir, drivers.pin_hash ile kontrol edilir (hashPin, driverAuth.js
//      ile PAYLAŞILAN fonksiyon - aynı PIN hem Android app'e hem web
//      paneline giriyor) - rol: sofor, id: sürücünün id'si.
//
// Sessions are a signed, stateless cookie (HMAC over `role.id.exp`) rather
// than a DB table, so login doesn't cost a D1 round-trip on every request -
// tek istisna: login sırasında kimliği doğrulamak için elbette bir sorgu
// gerekiyor, ama SONRAKİ her istekte cookie tek başına yetiyor.
//
// AUTH_PASSWORD, SESSION_SECRET ve USER_PASSWORD_PEPPER Worker secret'ları -
// never committed. Local dev: `.dev.vars` (gitignored). Production:
// `wrangler secret put <AD>`.
import { json } from "./utils.js";
import { hashPin } from "./driverAuth.js";

const SESSION_COOKIE = "lj_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 gün - dahili/güvenilir kullanım, sık girişe gerek yok

const ROLES = new Set(["yonetici", "operator"]); // "sofor" ayrıca var ama users tablosunda bir satır değil, session'da görünür

function base64UrlEncode(bytes) {
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Kullanıcı (yönetici/operatör) şifresi için - driverAuth.js'in hashPin'iyle
// AYNI desen ama ayrı bir pepper secret'ı ile (USER_PASSWORD_PEPPER) -
// ikisi karışmasın, biri sızarsa diğerini etkilemesin.
export function hashPassword(password, env) {
  return sha256Hex(`${password}:${env.USER_PASSWORD_PEPPER || ""}`);
}

// Constant-time string compare - avoids leaking the password/signature
// byte-by-byte through response timing. (Length itself still leaks via the
// early return; harmless here - the attacker learns nothing actionable from
// password *length*.)
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Cookie'yi doğrular, geçerliyse { role, id } döner (id boşsa null - ana
// şifre/master oturumu) - geçersizse/eksikse null.
async function getSession(request, env) {
  const cookie = getCookie(request, SESSION_COOKIE);
  if (!cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = await hmac(env.SESSION_SECRET || "", payload);
  if (!timingSafeEqual(sig, expected)) return null;

  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  const [role, id, expStr] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() >= exp) return null;
  return { role, id: id || null };
}

async function sessionCookieHeader(env, secure, role, id) {
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${role}.${id || ""}.${exp}`;
  const sig = await hmac(env.SESSION_SECRET || "", payload);
  return `${SESSION_COOKIE}=${payload}.${sig}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function clearedSessionCookieHeader(secure) {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`;
}

// Called by index.js before dispatching to any non-auth route. Returns
// { session, error } - error is a 401 Response if not authenticated (caller
// should return it as-is), session is { role, id } otherwise. Route
// gruplarının rol bazlı erişim kararları worker/index.js'te session.role'e
// bakarak veriliyor.
export async function requireAuth(request, env) {
  const session = await getSession(request, env);
  if (!session) return { session: null, error: json({ error: "Giriş gerekli." }, { status: 401 }) };
  return { session, error: null };
}

// Handles /api/auth/*. Returns a Response if it owns this route, or null so
// the caller can fall through to other route handlers.
export async function handleAuthRoute(request, env, url) {
  const secure = url.protocol === "https:";

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Geçersiz istek." }, { status: 400 });
    }
    const kullaniciAdi = String(body.username ?? "").trim();
    const submitted = String(body.password ?? "");
    if (!submitted) return json({ error: "Şifre zorunlu." }, { status: 401 });

    // 1. Kullanıcı adı boşsa: ana şifre (eski davranış, bootstrap/kurtarma).
    if (!kullaniciAdi) {
      const expected = env.AUTH_PASSWORD || "";
      if (!expected) return json({ error: "Sunucuda AUTH_PASSWORD tanımlı değil." }, { status: 500 });
      if (!timingSafeEqual(submitted, expected)) {
        return json({ error: "Şifre yanlış." }, { status: 401 });
      }
      return json(
        { ok: true, role: "yonetici", id: null },
        { headers: { "Set-Cookie": await sessionCookieHeader(env, secure, "yonetici", "") } }
      );
    }

    // 2. Kullanıcı adı users tablosunda mı?
    const user = await env.DB.prepare("SELECT * FROM users WHERE kullanici_adi = ?1").bind(kullaniciAdi).first();
    if (user && user.aktif) {
      const hash = await hashPassword(submitted, env);
      if (timingSafeEqual(hash, user.sifre_hash)) {
        return json(
          { ok: true, role: user.rol, id: user.id, ad: user.ad },
          { headers: { "Set-Cookie": await sessionCookieHeader(env, secure, user.rol, user.id) } }
        );
      }
      return json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
    }

    // 3. Kullanıcı adı bir sürücü kodu mu? (aynı kod+PIN, Android app'le
    // paylaşılan - bkz. driverAuth.js handleDriverAuthRoute)
    const driver = await env.DB.prepare("SELECT * FROM drivers WHERE kod = ?1").bind(kullaniciAdi).first();
    if (driver && driver.aktif) {
      const hash = await hashPin(submitted, env);
      if (timingSafeEqual(hash, driver.pin_hash)) {
        return json(
          { ok: true, role: "sofor", id: driver.id, ad: driver.ad },
          { headers: { "Set-Cookie": await sessionCookieHeader(env, secure, "sofor", driver.id) } }
        );
      }
      return json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
    }

    return json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookieHeader(secure) } });
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false });
    return json({ authenticated: true, role: session.role, id: session.id });
  }

  return null;
}

export { ROLES };
