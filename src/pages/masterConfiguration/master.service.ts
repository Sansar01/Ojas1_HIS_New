/**
 * Master-configuration feature service — hospital master data.
 *
 * Global masters:
 *   GET    /api/hospital/masters/global/sidebar              fetchGlobalSidebar()
 *   GET    /api/hospital/masters/global/type/:type           fetchGlobalByType(type)
 *   GET    /api/hospital/masters/global/dropdown/:type       fetchGlobalDropdown(type)
 *   POST   /api/hospital/masters/global                      createGlobalMaster(payload)
 *   PATCH  /api/hospital/masters/global/:id                  updateGlobalMaster(id, payload)
 *   DELETE /api/hospital/masters/global/:id                  deleteGlobalMaster(id)
 *
 * Panels / services / tariffs:
 *   GET    /api/hospital/masters/panels                      fetchPanels(params?)
 *   POST   /api/hospital/masters/panels                      createPanel(payload)
 *   GET    /api/hospital/masters/panels/dropdown             fetchPanelDropdown()
 *   GET    /api/hospital/masters/services                    fetchServices()
 *   POST   /api/hospital/masters/services                    createService(payload)
 *   PATCH  /api/hospital/masters/services/:id                updateService(id, payload)
 *   DELETE /api/hospital/masters/services/:id                deleteService(id)
 *   GET    /api/hospital/masters/tariffs                     fetchTariffs()
 *   GET    /api/hospital/masters/tariffs/dropdown            fetchTariffDropdown()
 *   GET    /api/hospital/masters/tariffs/:id                 fetchTariffById(id)
 *   POST   /api/hospital/masters/tariffs                     createTariff(payload)
 *   DELETE /api/hospital/masters/tariffs/:id                 deleteTariff(id)
 *   POST   /api/hospital/masters/tariffs/:id/rates/bulk      saveTariffRates(id, rates)
 *
 * One function per endpoint — no aliases, no per-screen duplicates. The
 * master-configuration screens and the forms that need a dropdown (patient
 * registration, billing) call these directly and keep the rows in local state.
 */

import { axios } from "@/api/axios";

/* ------------------------------ endpoints -------------------------------- */

const MASTERS = "/api/hospital/masters";
const GLOBAL = `${MASTERS}/global`;
const PANELS = `${MASTERS}/panels`;
const SERVICES = `${MASTERS}/services`;
const TARIFFS = `${MASTERS}/tariffs`;

/* -------------------------------- types ---------------------------------- */

export interface GlobalMasterPayload {
  category: string;
  type: string;
  value: string;
  [key: string]: unknown;
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

export type PanelPayload = Record<string, any>;
export type ServicePayload = Record<string, any>;

/* ---------------------------- global masters ------------------------------ */

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const masterService = {
  fetchGlobalSidebar: () => axios.get(`${GLOBAL}/sidebar`),
  fetchGlobalByType: (type: string) => axios.get(`${GLOBAL}/type/${type}`),
  /** Dropdown values of one global master type. */
  fetchGlobalDropdown: (type: string) =>
    axios.get(`${GLOBAL}/dropdown/${type}`),
  createGlobalMaster: (payload: GlobalMasterPayload) =>
    axios.post(GLOBAL, payload),
  updateGlobalMaster: (id: string | number, payload: Record<string, unknown>) =>
    axios.patch(`${GLOBAL}/${id}`, payload),
  deleteGlobalMaster: (id: string | number) => axios.delete(`${GLOBAL}/${id}`),
  /* -------------------------------- panels --------------------------------- */
  fetchPanels: (params?: Record<string, unknown>) =>
    axios.get(PANELS, { params }),
  createPanel: (payload: PanelPayload) => axios.post(PANELS, payload),
  fetchPanelDropdown: () => axios.get(`${PANELS}/dropdown`),
  /* ------------------------------- services -------------------------------- */
  fetchServices: () => axios.get(SERVICES),
  createService: (payload: ServicePayload) => axios.post(SERVICES, payload),
  updateService: (id: string | number, payload: ServicePayload) =>
    axios.patch(`${SERVICES}/${id}`, payload),
  deleteService: (id: string | number) => axios.delete(`${SERVICES}/${id}`),
  /* -------------------------------- tariffs -------------------------------- */
  fetchTariffs: () => axios.get(TARIFFS),
  fetchTariffDropdown: () => axios.get(`${TARIFFS}/dropdown`),
  fetchTariffById: (id: string | number) => axios.get(`${TARIFFS}/${id}`),
  createTariff: (payload: { tariffCode: string; tariffName: string }) =>
    axios.post(TARIFFS, payload),
  deleteTariff: (id: string | number) => axios.delete(`${TARIFFS}/${id}`),
  /** Bulk upsert of the rate matrix of one tariff. */
  saveTariffRates: (tariffId: string | number, rates: TariffRateEntry[]) =>
    axios.post(`${TARIFFS}/${tariffId}/rates/bulk`, { rates }),
};
