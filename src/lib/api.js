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

export function login(password) {
  return request("/api/auth/login", withJsonBody("POST", { password }));
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export async function fetchAuthStatus() {
  const data = await request("/api/auth/me");
  return data.authenticated;
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
