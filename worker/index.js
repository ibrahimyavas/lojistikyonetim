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

async function handleAdvancedRoutes(request, env, pathname) {
  // Routes
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

  // 3D Packing Plans
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

  // ePOD
  if (pathname === "/api/pod" && request.method === "POST") {
    return submitProofOfDelivery(request, env);
  }
  const podMatch = pathname.match(/^\/api\/shipments\/([^\/]+)\/pod$/);
  if (podMatch && request.method === "GET") {
    return getProofOfDelivery(env, podMatch[1]);
  }

  return null;
}

async function handleApi(request, env, url) {
  // Auth routes are public by definition: /api/auth/* (admin web panel,
  // cookie session) and /api/driver-auth/login (Android sürücü app, Bearer
  // token - bkz. driverAuth.js, admin panelinden AYRI bir kimlik doğrulama).
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
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const driversResponse = await handleDriversRoute(request, env, url.pathname);
  if (driversResponse) return driversResponse;

  const vehiclesResponse = await handleVehiclesRoute(request, env, url.pathname);
  if (vehiclesResponse) return vehiclesResponse;

  const warehousesResponse = await handleWarehousesRoute(request, env, url.pathname);
  if (warehousesResponse) return warehousesResponse;

  const shipmentsResponse = await handleShipmentsRoute(request, env, url.pathname);
  if (shipmentsResponse) return shipmentsResponse;

  const warehouseTransfersResponse = await handleWarehouseTransfersRoute(request, env, url.pathname);
  if (warehouseTransfersResponse) return warehouseTransfersResponse;

  const warehouseZonesResponse = await handleWarehouseZonesRoute(request, env, url.pathname);
  if (warehouseZonesResponse) return warehouseZonesResponse;

  const palletsResponse = await handlePalletsRoute(request, env, url.pathname);
  if (palletsResponse) return palletsResponse;

  const adminLocationsResponse = await handleAdminLocationsRoute(request, env, url.pathname);
  if (adminLocationsResponse) return adminLocationsResponse;

  const advancedResponse = await handleAdvancedRoutes(request, env, url.pathname);
  if (advancedResponse) return advancedResponse;

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
