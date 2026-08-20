// Cloudflare Worker: serves the built SPA for everything except /api/*, and
// will back each web-panel screen's data with tiny D1-backed REST routes
// under /api/*. No framework - route handlers live one per module in this
// folder (auth.js, ...) and get registered below, same pattern as the
// barkod-okuyucu ERP project this was split off from.
import { json } from "./utils.js";
import { handleAuthRoute, requireAuth } from "./auth.js";
import { handleDriverAuthRoute } from "./driverAuth.js";
import { handleDriversRoute } from "./drivers.js";
import { handleVehiclesRoute } from "./vehicles.js";
import { handleWarehousesRoute } from "./warehouses.js";
import { handleShipmentsRoute } from "./shipments.js";
import { handleWarehouseTransfersRoute } from "./warehouseTransfers.js";
import { handleWarehouseZonesRoute } from "./warehouseZones.js";
import { handlePalletsRoute } from "./pallets.js";
import { handleDriverLocationsRoute, handleAdminLocationsRoute } from "./driverLocations.js";
import { handleUsersRoute } from "./users.js";
import {
  listOptimizedRoutes,
  createOptimizedRoute,
  deleteOptimizedRoute,
  listPackingPlans,
  createPackingPlan,
  deletePackingPlan,
  getProofOfDelivery,
  submitProofOfDelivery
} from "./advancedLogistics.js";

function isReadOnlyMethod(method) {
  return method === "GET" || method === "HEAD";
}

function pathIn(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// Rol bazlı erişim matrisi - her route grubu için hangi rollerin hangi
// HTTP metodlarıyla erişebileceği. GATE-BEFORE-DISPATCH: her grup için önce
// pathname öneki kontrol edilip rol izin vermiyorsa handler HİÇ
// ÇAĞRILMADAN 403 dönülüyor - aksi halde (önce çağırıp sonucu atma gibi)
// bir POST/PATCH/DELETE, engellenmeden ÖNCE veritabanını değiştirebilirdi.
//
// "sofor" burada hiçbir grupta YOK - şoförün tek erişimi shipments (kendi
// sevkiyatları, worker/shipments.js session alıp filtreliyor/sahiplik
// kontrolü yapıyor) ve pod (aşağıda, sahiplik kontrolüyle); listedeki
// gruplardan hiçbirine giremiyor.
const ROUTE_GROUPS = [
  { prefix: "/api/drivers", access: { yonetici: "full", operator: "read" }, handler: handleDriversRoute },
  { prefix: "/api/vehicles", access: { yonetici: "full", operator: "read" }, handler: handleVehiclesRoute },
  { prefix: "/api/warehouses", access: { yonetici: "full", operator: "read" }, handler: handleWarehousesRoute },
  { prefix: "/api/warehouse-zones", access: { yonetici: "full", operator: "read" }, handler: handleWarehouseZonesRoute },
  { prefix: "/api/warehouse-transfers", access: { yonetici: "full", operator: "full" }, handler: handleWarehouseTransfersRoute },
  { prefix: "/api/pallets", access: { yonetici: "full", operator: "full" }, handler: handlePalletsRoute },
  { prefix: "/api/driver-locations", access: { yonetici: "full", operator: "full" }, handler: handleAdminLocationsRoute },
  { prefix: "/api/users", access: { yonetici: "full" }, handler: handleUsersRoute },
  { prefix: "/api/routes", access: { yonetici: "full" }, handler: (req, env, path) => handleAdvancedRoutes(req, env, path) },
  { prefix: "/api/packing-plans", access: { yonetici: "full" }, handler: (req, env, path) => handleAdvancedRoutes(req, env, path) },
];

function roleAllowed(access, role, method) {
  const level = access[role];
  if (level === "full") return true;
  if (level === "read" && isReadOnlyMethod(method)) return true;
  return false;
}

async function handleAdvancedRoutes(request, env, pathname, session) {
  if (pathname === "/api/routes" && request.method === "GET") {
    return listOptimizedRoutes(env);
  }
  if (pathname === "/api/routes" && request.method === "POST") {
    return createOptimizedRoute(request, env);
  }
  const routeDelMatch = pathname.match(/^\/api\/routes\/([^\/]+)$/);
  if (routeDelMatch && request.method === "DELETE") {
    return deleteOptimizedRoute(env, routeDelMatch[1]);
  }

  if (pathname === "/api/packing-plans" && request.method === "GET") {
    return listPackingPlans(env);
  }
  if (pathname === "/api/packing-plans" && request.method === "POST") {
    return createPackingPlan(request, env);
  }
  const planDelMatch = pathname.match(/^\/api\/packing-plans\/([^\/]+)$/);
  if (planDelMatch && request.method === "DELETE") {
    return deletePackingPlan(env, planDelMatch[1]);
  }

  // e-POD - Yönetici/Operatör serbest, Şoför sadece KENDİ sevkiyatı için
  // (bkz. advancedLogistics.js submitProofOfDelivery/getProofOfDelivery'nin
  // session parametresiyle yaptığı sahiplik kontrolü) - bu ikisi
  // ROUTE_GROUPS'ta YOK, "advanced" grubunun Yönetici-only kapısından
  // MUAF, ayrı ele alınıyor (aşağıda handleApi'de).
  if (pathname === "/api/pod" && request.method === "POST") {
    return submitProofOfDelivery(request, env, session);
  }
  const podMatch = pathname.match(/^\/api\/shipments\/([^\/]+)\/pod$/);
  if (podMatch && request.method === "GET") {
    return getProofOfDelivery(env, podMatch[1], session);
  }

  return null;
}

async function handleApi(request, env, url) {
  // Auth routes are public by definition: /api/auth/* (admin web panel,
  // cookie session - artık üç rol de buradan giriyor, bkz. auth.js) ve
  // /api/driver-auth/login (Android sürücü app, Bearer token - bkz.
  // driverAuth.js, admin panelinden AYRI bir kimlik doğrulama).
  const authResponse = await handleAuthRoute(request, env, url);
  if (authResponse) return authResponse;

  const driverAuthResponse = await handleDriverAuthRoute(request, env, url.pathname);
  if (driverAuthResponse) return driverAuthResponse;

  // Sürücü app'inin konum bildirme uç noktası - KENDİ Bearer token auth'unu
  // taşıyor (requireDriverAuth, driverLocations.js içinde), admin cookie
  // oturumu GEREKMİYOR - bu yüzden requireAuth'tan ÖNCE ele alınıyor.
  const driverLocationsResponse = await handleDriverLocationsRoute(request, env, url.pathname);
  if (driverLocationsResponse) return driverLocationsResponse;

  // Aşağıdaki route'ların hepsi admin panelinin (cookie) oturumunu
  // gerektiriyor.
  const { session, error: authError } = await requireAuth(request, env);
  if (authError) return authError;

  // e-POD, ROUTE_GROUPS'taki "/api/routes"/"/api/packing-plans" önekleriyle
  // ÇAKIŞMIYOR (/api/pod, /api/shipments/:id/pod) - bu yüzden gruplardan
  // ÖNCE, kendi sahiplik mantığıyla ayrı ele alınıyor.
  const isPodPath = url.pathname === "/api/pod" || /^\/api\/shipments\/[^/]+\/pod$/.test(url.pathname);
  if (isPodPath) {
    const podResponse = await handleAdvancedRoutes(request, env, url.pathname, session);
    if (podResponse) return podResponse;
  }

  for (const group of ROUTE_GROUPS) {
    if (!pathIn(url.pathname, group.prefix)) continue;
    if (!roleAllowed(group.access, session.role, request.method)) {
      return json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }
    const response = await group.handler(request, env, url.pathname, session);
    if (response) return response;
  }

  // Sevkiyat - Yönetici/Operatör tam erişim, Şoför SADECE kendi sevkiyatları
  // (worker/shipments.js session'ı alıp GET'i filtreliyor, PATCH'te
  // sahiplik kontrolü yapıyor) - rol gruplarında YOK, session doğrudan
  // handler'a geçip kararı orada veriyor.
  const shipmentsResponse = await handleShipmentsRoute(request, env, url.pathname, session);
  if (shipmentsResponse) return shipmentsResponse;

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
