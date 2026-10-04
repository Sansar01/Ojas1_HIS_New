/**
 * Master domain API — hospital master configuration.
 *
 * Every master dataset in the configuration module is served from this ONE
 * domain (Rule 26) instead of each screen inventing its own requests:
 *
 *   global masters   → masters.global.*        (sidebar, by type, dropdown,
 *                                               create, update)
 *   panels           → masters.panels.*        (list, create)
 *   services         → masters.services.*      (list, create, update, remove)
 *   tariffs          → masters.tariffs.*       (list, dropdown, create, rates)
 *
 * One function per endpoint — no aliases or convenience duplicates, so every
 * request has exactly one definition in the whole application.
 *
 * State ownership (Rule 21 — one strategy per dataset):
 *   • dropdown/reference data shared by several forms is cached in
 *     `masterSlice` (loaded once, reused everywhere, in-flight guarded);
 *   • the configuration tables themselves are page-scoped and use these
 *     functions with local state.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";

export interface GlobalMasterPayload {
  category: string;
  type: string;
  value: string;
}

/** A dropdown option as the master API returns it. */
export interface MasterDropdownItem {
  id: string | number;
  value: string;
  [key: string]: unknown;
}

export interface TariffRateEntry {
  serviceId: string | number;
  rate: number;
  discountPercent?: number;
}

export const masterApi = {
  /* ------------------------ generic master tables ------------------------- */

  /* --------------------------- global masters ----------------------------- */

  globalSidebar: () =>
    apiClient(API_ENDPOINTS.masters.global.sidebar, { method: "GET" }),

  globalByType: (type: string) =>
    apiClient(API_ENDPOINTS.masters.global.byType(type), { method: "GET" }),

  /** Dropdown values of one global master type (cached in `masterSlice`). */
  globalDropdown: (type: string) =>
    apiClient<MasterDropdownItem[]>(
      API_ENDPOINTS.masters.global.dropdown(type),
      { method: "GET" },
    ),

  globalCreate: (payload: GlobalMasterPayload) =>
    apiClient(API_ENDPOINTS.masters.global.create, {
      method: "POST",
      body: payload,
    }),

  globalUpdate: (id: string | number, payload: Record<string, unknown>) =>
    apiClient(API_ENDPOINTS.masters.global.byId(id), {
      method: "PATCH",
      body: payload,
    }),

  globalRemove: (id: string | number) =>
    apiClient(API_ENDPOINTS.masters.global.byId(id), { method: "DELETE" }),

  /* -------------------------------- panels -------------------------------- */

  listPanels: (params?: Record<string, unknown>) =>
    apiClient(API_ENDPOINTS.masters.panels.list, { method: "GET", params }),

  createPanel: (payload: unknown) =>
    apiClient(API_ENDPOINTS.masters.panels.list, { method: "POST", body: payload }),

  panelDropdown: () =>
    apiClient(API_ENDPOINTS.masters.panels.dropdown, { method: "GET" }),

  /* ------------------------------- services ------------------------------- */

  listServices: () =>
    apiClient(API_ENDPOINTS.masters.services.list, { method: "GET" }),

  createService: (payload: unknown) =>
    apiClient(API_ENDPOINTS.masters.services.list, {
      method: "POST",
      body: payload,
    }),

  updateService: (id: string | number, payload: unknown) =>
    apiClient(API_ENDPOINTS.masters.services.byId(id), {
      method: "PATCH",
      body: payload,
    }),

  removeService: (id: string | number) =>
    apiClient(API_ENDPOINTS.masters.services.byId(id), { method: "DELETE" }),

  /* -------------------------------- tariffs ------------------------------- */

  listTariffs: () =>
    apiClient(API_ENDPOINTS.masters.tariffs.list, { method: "GET" }),

  tariffDropdown: () =>
    apiClient(API_ENDPOINTS.masters.tariffs.dropdown, { method: "GET" }),

  getTariff: (id: string | number) =>
    apiClient(API_ENDPOINTS.masters.tariffs.byId(id), { method: "GET" }),

  createTariff: (payload: { tariffCode: string; tariffName: string }) =>
    apiClient(API_ENDPOINTS.masters.tariffs.list, {
      method: "POST",
      body: payload,
    }),

  removeTariff: (id: string | number) =>
    apiClient(API_ENDPOINTS.masters.tariffs.byId(id), { method: "DELETE" }),

  /** Bulk upsert of the rate matrix of one tariff. */
  saveTariffRates: (tariffId: string | number, rates: TariffRateEntry[]) =>
    apiClient(API_ENDPOINTS.masters.tariffs.ratesBulk(tariffId), {
      method: "POST",
      body: { rates },
    }),
};

