// Cloudflare Worker: serves the built SPA for everything except /api/*, and
// will back each web-panel screen's data with tiny D1-backed REST routes
// under /api/*. No framework - route handlers live one per module in this
// folder (auth.js, ...) and get registered below, same pattern as the
// barkod-okuyucu ERP project this was split off from.
import { json } from "./utils.js";
import { handleAuthRoute, requireAuth } from "./auth.js";

async function handleApi(request, env, url) {
  // Auth routes (/api/auth/login, /logout, /me) are public by definition.
  const authResponse = await handleAuthRoute(request, env, url);
  if (authResponse) return authResponse;

  // Everything else requires a valid session.
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  // Next module routes get registered here, e.g.:
  //   const vehiclesResponse = await handleVehiclesRoute(request, env, url.pathname);
  //   if (vehiclesResponse) return vehiclesResponse;

  return json({ error: "Bulunamadı." }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: err?.message || "Sunucu hatası." }, { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
