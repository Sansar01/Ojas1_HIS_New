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

const apiHeaders = () => ({
  "Content-Type": "application/json",
  ...getAuthHeaders(),
});

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...apiHeaders(), ...(options?.headers || {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || "An API error occurred");
  return json;
}

// ─── Types ───────────────────────────────────────────────────────
export type ServiceCategory = "CONSULTATION" | "LAB" | "RADIOLOGY" | "PROCEDURE" | "PHARMACY" | "BED_CHARGE" | "OTHER";

export interface ServiceMasterItem {
  id: string;
  serviceCode: string;
  serviceName: string;
  category: ServiceCategory;
  baseRate: number | string;
  isActive: boolean;
}

export interface CreateServicePayload {
  serviceCode: string;
  serviceName: string;
  category: ServiceCategory;
  baseRate: number;
  isActive?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────
export const serviceMasterService = {
  list: (params?: { search?: string; category?: ServiceCategory }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.category) query.append("category", params.category);
    return fetchJson<ServiceMasterItem[]>(`${API_BASE_URL}/api/hospital/masters/services?${query}`);
  },

  getById: (id: string) => {
    return fetchJson<ServiceMasterItem>(`${API_BASE_URL}/api/hospital/masters/services/${id}`);
  },

  create: (payload: CreateServicePayload) => {
    return fetchJson<ServiceMasterItem>(`${API_BASE_URL}/api/hospital/masters/services`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: (id: string, payload: Partial<CreateServicePayload>) => {
    return fetchJson<ServiceMasterItem>(`${API_BASE_URL}/api/hospital/masters/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  remove: (id: string) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/services/${id}`, { method: "DELETE" });
  },
};