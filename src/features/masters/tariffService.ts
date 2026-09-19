export const API_BASE_URL: string =
  (import.meta.env as any).VITE_API_BASE_URL || "https://cloud-his-backend.onrender.com";

const getAuthHeaders = (): Record<string, string> => {
  try {
    const stored = JSON.parse(localStorage.getItem("authUserToken") || "null");
    const token = stored?.accessToken ?? stored?.token ?? null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const apiHeaders = () => ({ "Content-Type": "application/json", ...getAuthHeaders() });

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...apiHeaders(), ...(options?.headers || {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || "An API error occurred");
  return json;
}

// ─── Types ───────────────────────────────────────────────────────
export interface TariffMasterItem {
  id: string;
  tariffCode: string;
  tariffName: string;
  isActive: boolean;
  rates?: any[]; // Populated when getting by ID
}

export interface SetRatePayload {
  serviceId: string;
  rate: number;
  discountPercent?: number;
}

// ─── Service ─────────────────────────────────────────────────────
export const tariffService = {
  list: (params?: { search?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    return fetchJson<TariffMasterItem[]>(`${API_BASE_URL}/api/hospital/masters/tariffs?${query}`);
  },

  getDropdown: () => {
    return fetchJson<{ id: string; tariffCode: string; tariffName: string }[]>(
      `${API_BASE_URL}/api/hospital/masters/tariffs/dropdown`
    );
  },

  getById: (id: string) => {
    return fetchJson<TariffMasterItem>(`${API_BASE_URL}/api/hospital/masters/tariffs/${id}`);
  },

  create: (payload: { tariffCode: string; tariffName: string; isActive?: boolean }) => {
    return fetchJson<TariffMasterItem>(`${API_BASE_URL}/api/hospital/masters/tariffs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: (id: string, payload: { tariffCode?: string; tariffName?: string; isActive?: boolean }) => {
    return fetchJson<TariffMasterItem>(`${API_BASE_URL}/api/hospital/masters/tariffs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  remove: (id: string) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/tariffs/${id}`, { method: "DELETE" });
  },

  // ─── Rate Mappings ───
  setRate: (tariffId: string, payload: SetRatePayload) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/tariffs/${tariffId}/rates`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  bulkSetRates: (tariffId: string, rates: SetRatePayload[]) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/tariffs/${tariffId}/rates/bulk`, {
      method: "POST",
      body: JSON.stringify({ rates }),
    });
  },

  removeRate: (tariffId: string, serviceId: string) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/tariffs/${tariffId}/rates/${serviceId}`, {
      method: "DELETE",
    });
  },
};