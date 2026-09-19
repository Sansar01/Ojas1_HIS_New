// src/features/masters/globalMasterService.ts

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
  const res = await fetch(url, {
    ...options,
    headers: {
      ...apiHeaders(),
      ...(options?.headers || {}),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || json.error || "An API error occurred");
  }
  return json;
}

// ─── Types ───────────────────────────────────────────────────────
export type MasterCategory = "PANEL_BILLING" | "CLINICAL" | "INVENTORY" | "GENERAL";

export type MasterValueType =
  | "GROUP_TYPE"
  | "PAYMENT_MODE"
  | "RATE_TYPE"
  | "CURRENCY"
  | "PANEL_TYPE"
  | "TAX_TYPE"
  | "DISCOUNT_REASON"
  | "REFUND_REASON"
  | "CANCELLATION_REASON"
  | "CONSULTATION_TYPE"
  | "DIAGNOSIS_TYPE"
  | "DIET_TYPE";

export interface GlobalMasterItem {
  id: string;
  value: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface SidebarItem {
  type: MasterValueType;
  label: string;
  count: number;
}

export interface SidebarTree {
  "PANEL / BILLING": SidebarItem[];
  CLINICAL: SidebarItem[];
}

export interface CreateGlobalMasterPayload {
  category: MasterCategory;
  type: MasterValueType;
  value: string;
  sortOrder?: number;
}

export interface UpdateGlobalMasterPayload {
  value?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────
export const globalMasterService = {
  // GET /hospital/masters/global/sidebar
  getSidebar: () => {
    return fetchJson<SidebarTree>(
      `${API_BASE_URL}/api/hospital/masters/global/sidebar`,
    );
  },

  // GET /hospital/masters/global/type/:type?search=
  getByType: (type: MasterValueType, search?: string) => {
    const query = new URLSearchParams();
    if (search) query.append("search", search);
    const qs = query.toString();
    return fetchJson<GlobalMasterItem[]>(
      `${API_BASE_URL}/api/hospital/masters/global/type/${type}${qs ? `?${qs}` : ""}`,
    );
  },

  // GET /hospital/masters/global/dropdown/:type
  // Lightweight — only id + value (for use in other forms like Panel Master)
  getDropdown: (type: MasterValueType) => {
    return fetchJson<{ id: string; value: string }[]>(
      `${API_BASE_URL}/api/hospital/masters/global/dropdown/${type}`,
    );
  },

  // POST /hospital/masters/global
  create: (payload: CreateGlobalMasterPayload) => {
    return fetchJson<GlobalMasterItem>(
      `${API_BASE_URL}/api/hospital/masters/global`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  // PATCH /hospital/masters/global/:id
  update: (id: string, payload: UpdateGlobalMasterPayload) => {
    return fetchJson<GlobalMasterItem>(
      `${API_BASE_URL}/api/hospital/masters/global/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  // PATCH helper — toggle active/inactive
  setActive: (id: string, isActive: boolean) => {
    return fetchJson<GlobalMasterItem>(
      `${API_BASE_URL}/api/hospital/masters/global/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      },
    );
  },

  // DELETE /hospital/masters/global/:id
  remove: (id: string) => {
    return fetchJson<{ message: string }>(
      `${API_BASE_URL}/api/hospital/masters/global/${id}`,
      {
        method: "DELETE",
      },
    );
  },

  // POST /hospital/masters/global/reorder/:type
  reorder: (type: MasterValueType, orderedIds: string[]) => {
    return fetchJson<{ message: string }>(
      `${API_BASE_URL}/api/hospital/masters/global/reorder/${type}`,
      {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      },
    );
  },

  // POST /hospital/masters/global/seed  (dev / onboarding helper)
  seed: () => {
    return fetchJson<{ inserted: number }>(
      `${API_BASE_URL}/api/hospital/masters/global/seed`,
      {
        method: "POST",
      },
    );
  },
};