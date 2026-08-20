// Thin fetch wrapper for the /api/* routes the Worker exposes (see
// worker/index.js). Everything lives in D1, not localStorage - this is the
// one part of the app where the network is load-bearing.
async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  }
  if (!res.ok) {
    let message = `İstek başarısız (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON - keep the generic message
    }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

export function withJsonBody(method, body) {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

// `username` boş bırakılırsa ana şifre (AUTH_PASSWORD) ile giriş - eski
// davranış, bootstrap/kurtarma yolu. Doluysa ya bir users.kullanici_adi
// (Yönetici/Operatör) ya da bir drivers.kod (Şoför, aynı Android app
// kod+PIN'i) ile eşleştirilmeye çalışılıyor - bkz. worker/auth.js.
export function login(username, password) {
  return request("/api/auth/login", withJsonBody("POST", { username, password }));
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

// { authenticated, role, id } döner - role: "yonetici" | "operator" | "sofor",
// id: users.id ya da drivers.id (ana şifreyle girildiyse null).
export async function fetchSession() {
  return request("/api/auth/me");
}

export async function fetchUsers() {
  const data = await request("/api/users");
  return data.users;
}

export function createUser(user) {
  return request("/api/users", withJsonBody("POST", user));
}

export function updateUser(id, fields) {
  return request(`/api/users/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deleteUser(id) {
  return request(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchDrivers() {
  const data = await request("/api/drivers");
  return data.drivers;
}

export function createDriver(driver) {
  return request("/api/drivers", withJsonBody("POST", driver));
}

export function updateDriver(id, fields) {
  return request(`/api/drivers/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deleteDriver(id) {
  return request(`/api/drivers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchVehicles() {
  const data = await request("/api/vehicles");
  return data.vehicles;
}

export function createVehicle(vehicle) {
  return request("/api/vehicles", withJsonBody("POST", vehicle));
}

export function updateVehicle(id, fields) {
  return request(`/api/vehicles/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deleteVehicle(id) {
  return request(`/api/vehicles/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchWarehouses() {
  const data = await request("/api/warehouses");
  return data.warehouses;
}

export function createWarehouse(warehouse) {
  return request("/api/warehouses", withJsonBody("POST", warehouse));
}

export function updateWarehouse(id, fields) {
  return request(`/api/warehouses/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deleteWarehouse(id) {
  return request(`/api/warehouses/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchShipments() {
  const data = await request("/api/shipments");
  return data.shipments;
}

// QR "canlı referans"ı okutunca o sevkiyatın O ANKİ halini çekmek için
// (bkz. lib/qrPayload.js buildRouteRef/parseRouteRef) - listedeki
// (muhtemelen bayat) yerel kopyaya değil, doğrudan sunucuya soruyoruz.
export async function fetchShipment(id) {
  const data = await request(`/api/shipments/${encodeURIComponent(id)}`);
  return data.shipment;
}

export function createShipment(shipment) {
  return request("/api/shipments", withJsonBody("POST", shipment));
}

export function updateShipment(id, fields) {
  return request(`/api/shipments/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deleteShipment(id) {
  return request(`/api/shipments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchWarehouseTransfers() {
  const data = await request("/api/warehouse-transfers");
  return data.transfers;
}

// fetchShipment ile aynı amaç - Depo Transferi için canlı okuma.
export async function fetchWarehouseTransfer(id) {
  const data = await request(`/api/warehouse-transfers/${encodeURIComponent(id)}`);
  return data.transfer;
}

export function createWarehouseTransfer(transfer) {
  return request("/api/warehouse-transfers", withJsonBody("POST", transfer));
}

export function updateWarehouseTransfer(id, fields) {
  return request(`/api/warehouse-transfers/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deleteWarehouseTransfer(id) {
  return request(`/api/warehouse-transfers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchWarehouseZones() {
  const data = await request("/api/warehouse-zones");
  return data.zones;
}

export function createWarehouseZone(zone) {
  return request("/api/warehouse-zones", withJsonBody("POST", zone));
}

export function updateWarehouseZone(id, fields) {
  return request(`/api/warehouse-zones/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deleteWarehouseZone(id) {
  return request(`/api/warehouse-zones/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchPallets() {
  const data = await request("/api/pallets");
  return data.pallets;
}

export function createPallet(pallet) {
  return request("/api/pallets", withJsonBody("POST", pallet));
}

export function updatePallet(id, fields) {
  return request(`/api/pallets/${encodeURIComponent(id)}`, withJsonBody("PATCH", fields));
}

export function deletePallet(id) {
  return request(`/api/pallets/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchPalletMovements(palletId) {
  const data = await request(`/api/pallets/${encodeURIComponent(palletId)}/movements`);
  return data.movements;
}

// Sürücülerin son bildirdikleri konum - admin paneli (cookie auth).
// Sürücü app'inin KENDİ konum bildirme uç noktası (POST /api/driver/location,
// Bearer token) burada değil - Android app doğrudan çağıracak, web
// panelinin bir parçası değil.
export async function fetchDriverLocations() {
  const data = await request("/api/driver-locations");
  return data.locations;
}

export async function fetchDriverLocationHistory(driverId) {
  const data = await request(`/api/driver-locations/${encodeURIComponent(driverId)}/history`);
  return data.locations;
}

// -------------------------------------------------------------
// Gelişmiş Lojistik Algoritmaları & Motoru API Çağrıları
// -------------------------------------------------------------

export async function fetchOptimizedRoutes() {
  const data = await request("/api/routes");
  return data.routes || [];
}

export function saveOptimizedRoute(routeData) {
  return request("/api/routes", withJsonBody("POST", routeData));
}

export function deleteOptimizedRoute(id) {
  return request(`/api/routes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchPackingPlans() {
  const data = await request("/api/packing-plans");
  return data.packingPlans || [];
}

export function savePackingPlan(planData) {
  return request("/api/packing-plans", withJsonBody("POST", planData));
}

export function deletePackingPlan(id) {
  return request(`/api/packing-plans/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchProofOfDelivery(shipmentId) {
  const data = await request(`/api/shipments/${encodeURIComponent(shipmentId)}/pod`);
  return data;
}

export function submitProofOfDelivery(podData) {
  return request("/api/pod", withJsonBody("POST", podData));
}

