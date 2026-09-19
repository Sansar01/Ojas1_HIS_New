// src/features/billing/billingService.ts

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

export const billingService = {
  // ─── MASTER DATA ──────────────────────────────────────────────
  getPatients: (params?: { search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams({
      page: String(params?.page || 1),
      limit: String(params?.limit || 100),
      ...(params?.search ? { search: params.search } : {}),
    });
    return fetchJson<{ data: any[]; meta: any }>(`${API_BASE_URL}/api/opd/patients?${query}`);
  },

  getDoctors: () => {
    return fetchJson<{ data: any[] }>(`${API_BASE_URL}/api/opd/doctors/list`);
  },

  // 🟢 FIXED: Removed default "COMPLETED" status so all appointments (SCHEDULED, BOOKED, etc.) load
  getAppointments: (params?: { status?: string; patientId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "all") {
      query.append("status", params.status);
    }
    if (params?.patientId) {
      query.append("patientId", params.patientId);
    }
    return fetchJson<{ data: any[] }>(`${API_BASE_URL}/api/opd/appointments?${query}`);
  },

  // ─── BILLING & INVOICES ───────────────────────────────────────
  getBills: (filters: {
    page?: number;
    limit?: number;
    patientId?: string;
    date?: string;
    billStatus?: string;
    paymentStatus?: string;
  }) => {
    const query = new URLSearchParams();
    if (filters.page) query.append("page", String(filters.page));
    if (filters.limit) query.append("limit", String(filters.limit));
    if (filters.patientId) query.append("patientId", filters.patientId);
    if (filters.date) query.append("date", filters.date);
    if (filters.billStatus && filters.billStatus !== "all") query.append("billStatus", filters.billStatus);
    if (filters.paymentStatus && filters.paymentStatus !== "all") query.append("paymentStatus", filters.paymentStatus);

    return fetchJson<{ data: any[]; meta: any }>(`${API_BASE_URL}/api/opd/billing?${query}`);
  },

  getBillById: (id: string) => {
    return fetchJson<any>(`${API_BASE_URL}/api/opd/billing/${id}`);
  },

  getDailySummary: (date?: string) => {
    const query = date ? `?date=${date}` : "";
    return fetchJson<any>(`${API_BASE_URL}/api/opd/billing/daily-summary${query}`);
  },

  createBill: (payload: any) => {
    return fetchJson<any>(`${API_BASE_URL}/api/opd/billing`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cancelBill: (id: string, cancelReason: string) => {
    return fetchJson<any>(`${API_BASE_URL}/api/opd/billing/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ cancelReason }),
    });
  },

  // ─── PAYMENTS ──────────────────────────────────────────────────
  getPayments: (filters: {
    page?: number;
    limit?: number;
    patientId?: string;
    paymentMode?: string;
    date?: string;
  }) => {
    const query = new URLSearchParams();
    if (filters.page) query.append("page", String(filters.page));
    if (filters.limit) query.append("limit", String(filters.limit));
    if (filters.patientId) query.append("patientId", filters.patientId);
    if (filters.paymentMode && filters.paymentMode !== "all") query.append("paymentMode", filters.paymentMode);
    if (filters.date) query.append("date", filters.date);

    return fetchJson<{ data: any[]; meta: any }>(`${API_BASE_URL}/api/opd/billing/payments?${query}`);
  },

  collectPayment: (billId: string, payload: {
    amount: number;
    paymentMode: string;
    transactionId?: string;
    notes?: string;
  }) => {
    return fetchJson<any>(`${API_BASE_URL}/api/opd/billing/${billId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};