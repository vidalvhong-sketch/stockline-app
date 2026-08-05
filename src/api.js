const TOKEN_KEY = "stockline_token";
const NAME_KEY = "stockline_name";
const ROLE_KEY = "stockline_role";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getAgentName() {
  return localStorage.getItem(NAME_KEY);
}
export function getAgentRole() {
  return localStorage.getItem(ROLE_KEY);
}
export function setSession(token, name, role) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(ROLE_KEY, role);
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ROLE_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearSession();
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

export const api = {
  login: (name, pin) => request("/auth/login", { method: "POST", body: JSON.stringify({ name, pin }) }),
  getState: () => request("/state"),
  addSupplier: (payload) => request("/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  editSupplier: (id, payload) => request(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSupplier: (id) => request(`/suppliers/${id}`, { method: "DELETE" }),
  addProduct: (payload) => request("/products", { method: "POST", body: JSON.stringify(payload) }),
  editProduct: (id, payload) => request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  setProductStatus: (id, status) => request(`/products/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  purgeTransactionsBefore: (dateStr) => request(`/transactions?before=${encodeURIComponent(dateStr)}`, { method: "DELETE" }),
  logTransaction: (payload) => request("/transactions", { method: "POST", body: JSON.stringify(payload) }),
  getAgents: () => request("/agents"),
  addAgent: (payload) => request("/agents", { method: "POST", body: JSON.stringify(payload) }),
  resetAgentPin: (id, pin) => request(`/agents/${id}/reset-pin`, { method: "PATCH", body: JSON.stringify({ pin }) }),
  removeAgent: (id) => request(`/agents/${id}`, { method: "DELETE" }),
};
