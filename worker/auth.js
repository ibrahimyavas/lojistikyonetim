// Shared-password gate for the WEB PANEL (dispatcher/admin use). Sessions
// are a signed, stateless cookie (HMAC over an expiry timestamp) rather than
// a DB table, so login doesn't cost a D1 round-trip on every request.
//
// The Android driver app will need its OWN auth (per-driver identity, not a
// single shared password) - that's a separate scheme to design when the
// drivers/vehicles schema is built, not this cookie gate. Don't reuse this
// for driver-app requests.
//
// Both AUTH_PASSWORD and SESSION_SECRET are Worker secrets - never committed.
// Local dev: put them in `.dev.vars` (gitignored, see `.dev.vars.example`).
// Production: `wrangler secret put AUTH_PASSWORD` / `wrangler secret put SESSION_SECRET`.
import { json } from "./utils.js";

const SESSION_COOKIE = "lj_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 gün - dahili/güvenilir kullanım, sık girişe gerek yok

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

async function isAuthenticated(request, env) {
  const cookie = getCookie(request, SESSION_COOKIE);
  if (!cookie) return false;
  const dot = cookie.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = await hmac(env.SESSION_SECRET || "", payload);
  if (!timingSafeEqual(sig, expected)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() < exp;
}

async function sessionCookieHeader(env, secure) {
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(exp);
  const sig = await hmac(env.SESSION_SECRET || "", payload);
  return `${SESSION_COOKIE}=${payload}.${sig}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function clearedSessionCookieHeader(secure) {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`;
}

// Called by index.js before dispatching to any non-auth route. Returns a 401
// Response to short-circuit the request, or null if the caller may proceed.
export async function requireAuth(request, env) {
  return (await isAuthenticated(request, env)) ? null : json({ error: "Giriş gerekli." }, { status: 401 });
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
    const expected = env.AUTH_PASSWORD || "";
    if (!expected) {
      return json({ error: "Sunucuda AUTH_PASSWORD tanımlı değil." }, { status: 500 });
    }
    const submitted = String(body.password ?? "");
    if (!submitted || !timingSafeEqual(submitted, expected)) {
      return json({ error: "Şifre yanlış." }, { status: 401 });
    }
    return json({ ok: true }, { headers: { "Set-Cookie": await sessionCookieHeader(env, secure) } });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookieHeader(secure) } });
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return json({ authenticated: await isAuthenticated(request, env) });
  }

  return null;
}
