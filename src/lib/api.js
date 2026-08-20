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
