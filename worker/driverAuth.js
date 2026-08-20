// Sürücü (Android app) kimlik doğrulaması - admin web panelindeki
// worker/auth.js'ten BİLİNÇLİ OLARAK AYRI: tek paylaşılan şifre değil, her
// sürücünün kendi "kod" + PIN'i var, giriş bir Bearer token döner (cookie
// değil - mobil istemci için daha doğal).
//
// PIN'ler düz metin tutulmuyor - SHA-256(pin + DRIVER_PIN_PEPPER) olarak
// hash'leniyor. DRIVER_PIN_PEPPER bir Worker secret'ı (AUTH_PASSWORD/
// SESSION_SECRET gibi) - local'de .dev.vars'a, prod'da `wrangler secret put`
// ile eklenir.
import { json } from "./utils.js";

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashPin(pin, env) {
  return sha256Hex(`${pin}:${env.DRIVER_PIN_PEPPER || ""}`);
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
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 gün

function tokenSecret(env) {
  // Ayrı bir secret tanımlanmadıysa admin oturum sırrını yeniden kullanır -
  // ikisi de gizli tutulduğu sürece güvenli, ama pratikte ayrı tanımlamak
  // (DRIVER_TOKEN_SECRET) daha temiz: admin oturumlarını iptal etmek
  // (SESSION_SECRET'ı değiştirmek) sürücü token'larını etkilemez.
  return env.DRIVER_TOKEN_SECRET || env.SESSION_SECRET || "";
}

async function signDriverToken(driverId, env) {
  const payload = `${driverId}.${Date.now() + TOKEN_MAX_AGE_MS}`;
  const sig = await hmac(tokenSecret(env), payload);
  return `${payload}.${sig}`;
}

// İstekteki `Authorization: Bearer <token>` başlığını doğrular, geçerliyse
// sürücü id'sini döner - geçersizse/eksikse null.
export async function verifyDriverToken(request, env) {
  const header = request.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  const token = m[1];
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = await hmac(tokenSecret(env), payload);
  if (!timingSafeEqual(sig, expected)) return null;
  const dot = payload.indexOf(".");
  if (dot === -1) return null;
  const driverId = payload.slice(0, dot);
  const exp = Number(payload.slice(dot + 1));
  if (!Number.isFinite(exp) || Date.now() >= exp) return null;
  return driverId;
}

// Sürücü-korumalı route'ların başında çağrılır (henüz kullanılmıyor - ilk
// sürücü-app uç noktası, ör. konum bildirimi, eklenince kullanılacak).
export async function requireDriverAuth(request, env) {
  const driverId = await verifyDriverToken(request, env);
  if (!driverId) return { driverId: null, error: json({ error: "Sürücü girişi gerekli." }, { status: 401 }) };
  return { driverId, error: null };
}

// Handles /api/driver-auth/login. Public by definition (admin cookie auth
// ya da sürücü token'ı gerektirmez) - Android app'in ilk isteği.
export async function handleDriverAuthRoute(request, env, pathname) {
  if (pathname !== "/api/driver-auth/login" || request.method !== "POST") return null;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const kod = String(body.kod ?? "").trim();
  const pin = String(body.pin ?? "").trim();
  if (!kod || !pin) return json({ error: "Kod ve PIN zorunlu." }, { status: 400 });

  const row = await env.DB.prepare("SELECT * FROM drivers WHERE kod = ?1").bind(kod).first();
  if (!row || !row.aktif) return json({ error: "Kod veya PIN yanlış." }, { status: 401 });

  const submittedHash = await hashPin(pin, env);
  if (!timingSafeEqual(submittedHash, row.pin_hash)) {
    return json({ error: "Kod veya PIN yanlış." }, { status: 401 });
  }

  const token = await signDriverToken(row.id, env);
  return json({ token, driver: { id: row.id, ad: row.ad, kod: row.kod } });
}
