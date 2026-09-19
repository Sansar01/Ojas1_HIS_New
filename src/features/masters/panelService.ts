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
export type CoPaymentOn = "ON_BILL" | "ON_SERVICE" | "NONE";

export interface PanelMasterItem {
  id: string;
  panelCode: string;
  panelName: string;
  isActive: boolean;
  creditLimit: number;
  validFrom: string | null;
  validTo: string | null;
  // Includes populated global masters & tariffs
  groupType?: { id: string; value: string };
  panelType?: { id: string; value: string };
}

export interface CreatePanelPayload {
  panelName: string;
  groupTypeId?: string;
  paymentModeId?: string;
  panelTypeId?: string;
  rateCurrencyId?: string;
  billCurrencyId?: string;
  contactPerson?: string;
  contactNo?: string;
  phoneNo?: string;
  email?: string;
  address1?: string;
  address2?: string;
  faxNo?: string;
  validFrom?: string;
  validTo?: string;
  creditLimit?: number;
  opdTariffId?: string;
  ipdTariffId?: string;
  rateTypeSelfOpd?: boolean;
  rateTypeSelfIpd?: boolean;
  showPrintout?: boolean;
  hideRate?: boolean;
  coverNote?: boolean;
  isSmartCard?: boolean;
  hasEncounter?: boolean;
  isUsdBased?: boolean;
  dietTypePrivate?: boolean;
  coPaymentOn?: CoPaymentOn;
  coPaymentPercent?: number;
  currencyConv?: number;
  panelAmount?: number;
}

// ─── Service ─────────────────────────────────────────────────────
export const panelService = {
  list: (params?: { search?: string; groupTypeId?: string; isActive?: boolean; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.groupTypeId) query.append("groupTypeId", params.groupTypeId);
    if (params?.isActive !== undefined) query.append("isActive", String(params.isActive));
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));

    return fetchJson<{ data: PanelMasterItem[]; meta: any }>(
      `${API_BASE_URL}/api/hospital/masters/panels?${query}`
    );
  },

  getDropdown: () => {
    return fetchJson<{ id: string; panelCode: string; panelName: string; groupType: any; panelType: any }[]>(
      `${API_BASE_URL}/api/hospital/masters/panels/dropdown`
    );
  },

  getById: (id: string) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/panels/${id}`);
  },

  create: (payload: CreatePanelPayload) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/panels`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: (id: string, payload: Partial<CreatePanelPayload> & { isActive?: boolean }) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/panels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  remove: (id: string) => {
    return fetchJson<any>(`${API_BASE_URL}/api/hospital/masters/panels/${id}`, { method: "DELETE" });
  },
};