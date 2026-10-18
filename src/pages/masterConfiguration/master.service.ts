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
 * Relational service catalogue (service master v2):
 *   GET    /api/hospital/masters/service-categories          fetchServiceCategories(params?)
 *   GET    /api/hospital/masters/service-items               fetchServiceItems(params?)
 *   POST   /api/hospital/masters/service-items               createServiceItem(payload)
 *   PATCH  /api/hospital/masters/service-items/:id           updateServiceItem(id, payload)
 *   DELETE /api/hospital/masters/service-items/:id           deleteServiceItem(id)
 *
 * Lab / specimen masters (dependency order: departments → sample types → investigations):
 *   GET    /api/hospital/masters/lab-departments             fetchLabDepartments(params?)
 *   POST   /api/hospital/masters/lab-departments             createLabDepartment(payload)
 *   PATCH  /api/hospital/masters/lab-departments/:id         updateLabDepartment(id, payload)
 *   GET    /api/hospital/masters/sample-containers           fetchSampleContainers(params?)
 *   GET    /api/hospital/masters/sample-types                fetchSampleTypes(params?)
 *   POST   /api/hospital/masters/sample-types                createSampleType(payload)
 *   GET    /api/hospital/masters/investigations              fetchInvestigations(params?)
 *   POST   /api/hospital/masters/investigations              createInvestigation(payload)
 *   PATCH  /api/hospital/masters/investigations/:id          updateInvestigation(id, payload)
 *
 * Doctor management masters (clinical depts → specializations; doctor profiles
 * & schedules live in the doctors module, not here):
 *   GET    /api/hospital/masters/clinical-departments        fetchClinicalDepartments(params?)
 *   POST   /api/hospital/masters/clinical-departments        createClinicalDepartment(payload)
 *   PATCH  /api/hospital/masters/clinical-departments/:id    updateClinicalDepartment(id, payload)
 *   DELETE /api/hospital/masters/clinical-departments/:id    deleteClinicalDepartment(id)
 *   GET    /api/hospital/masters/specializations             fetchSpecializations(params?)
 *   GET    /api/hospital/masters/specializations/by-department/:deptId
 *                                                           fetchSpecializationsByDepartment(deptId)
 *   POST   /api/hospital/masters/specializations             createSpecialization(payload)
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
const SERVICE_CATEGORIES = `${MASTERS}/service-categories`;
const SERVICE_ITEMS = `${MASTERS}/service-items`;
const LAB_DEPARTMENTS = `${MASTERS}/lab-departments`;
const SAMPLE_CONTAINERS = `${MASTERS}/sample-containers`;
const SAMPLE_TYPES = `${MASTERS}/sample-types`;
const INVESTIGATIONS = `${MASTERS}/investigations`;
const CLINICAL_DEPARTMENTS = `${MASTERS}/clinical-departments`;
const SPECIALIZATIONS = `${MASTERS}/specializations`;

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

/** Write payload of a relational service item (create/update share the shape). */
export interface ServiceItemPayload {
  serviceName: string;
  serviceCode: string;
  categoryId: string;
  baseRate: number;
  itemType: string;
  rateEditable: boolean;
  discountable: boolean;
  /** Present only on update — toggles the active flag. */
  isActive?: boolean;
}

/** Write payload of a lab department (create/update share the shape). */
export interface LabDepartmentPayload {
  name: string;
  code: string;
  departmentType: string;
  turnaroundHours: number;
  allowTemplates: boolean;
}

/** Write payload of a sample type (create). */
export interface SampleTypePayload {
  name: string;
  code: string;
  defaultContainerId?: string;
  storageTemp: string;
  minVolumeMl?: number;
}

/** Write payload of an investigation (create/update share the shape). */
export interface InvestigationPayload {
  labDepartmentId: string;
  name: string;
  code: string;
  sampleTypeId: string;
  reportingFormat: string;
  outsourceTatHours: number;
}

/** Write payload of a clinical department. */
export interface ClinicalDepartmentPayload {
  name: string;
  code: string;
  description?: string;
}

/** Write payload of a doctor specialization. */
export interface SpecializationPayload {
  clinicalDepartmentId: string;
  name: string;
  code: string;
  description?: string;
}

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
  /* ------------------- relational service catalogue (v2) ------------------ */
  /** Category master of the service catalogue (e.g., `{ isActive: true }`). */
  fetchServiceCategories: (params?: Record<string, unknown>) =>
    axios.get(SERVICE_CATEGORIES, { params }),
  /** Service items (e.g., `{ isActive: true }`); rows carry `categoryRel`. */
  fetchServiceItems: (params?: Record<string, unknown>) =>
    axios.get(SERVICE_ITEMS, { params }),
  createServiceItem: (payload: ServiceItemPayload) =>
    axios.post(SERVICE_ITEMS, payload),
  updateServiceItem: (id: string | number, payload: Partial<ServiceItemPayload>) =>
    axios.patch(`${SERVICE_ITEMS}/${id}`, payload),
  deleteServiceItem: (id: string | number) =>
    axios.delete(`${SERVICE_ITEMS}/${id}`),
  /* ------------------- lab / specimen masters --------------------------- */
  /** Lab departments (parents of investigations). */
  fetchLabDepartments: (params?: Record<string, unknown>) =>
    axios.get(LAB_DEPARTMENTS, { params }),
  createLabDepartment: (payload: LabDepartmentPayload) =>
    axios.post(LAB_DEPARTMENTS, payload),
  updateLabDepartment: (id: string | number, payload: Partial<LabDepartmentPayload>) =>
    axios.patch(`${LAB_DEPARTMENTS}/${id}`, payload),
  /** Sample containers — only feeds the default-container dropdown. */
  fetchSampleContainers: (params?: Record<string, unknown>) =>
    axios.get(SAMPLE_CONTAINERS, { params }),
  /** Sample / specimen types. */
  fetchSampleTypes: (params?: Record<string, unknown>) =>
    axios.get(SAMPLE_TYPES, { params }),
  createSampleType: (payload: SampleTypePayload) =>
    axios.post(SAMPLE_TYPES, payload),
  /** Investigations — consume lab departments + sample types by id. */
  fetchInvestigations: (params?: Record<string, unknown>) =>
    axios.get(INVESTIGATIONS, { params }),
  createInvestigation: (payload: InvestigationPayload) =>
    axios.post(INVESTIGATIONS, payload),
  updateInvestigation: (id: string | number, payload: Partial<InvestigationPayload>) =>
    axios.patch(`${INVESTIGATIONS}/${id}`, payload),
  /* ------------------- doctor management masters -------------------------- */
  /** Clinical departments (parents of specializations). */
  fetchClinicalDepartments: (params?: Record<string, unknown>) =>
    axios.get(CLINICAL_DEPARTMENTS, { params }),
  createClinicalDepartment: (payload: ClinicalDepartmentPayload) =>
    axios.post(CLINICAL_DEPARTMENTS, payload),
  updateClinicalDepartment: (
    id: string | number,
    payload: Partial<ClinicalDepartmentPayload>,
  ) => axios.patch(`${CLINICAL_DEPARTMENTS}/${id}`, payload),
  deleteClinicalDepartment: (id: string | number) =>
    axios.delete(`${CLINICAL_DEPARTMENTS}/${id}`),
  /** Specializations — all, or scoped to one department. */
  fetchSpecializations: (params?: Record<string, unknown>) =>
    axios.get(SPECIALIZATIONS, { params }),
  fetchSpecializationsByDepartment: (deptId: string | number) =>
    axios.get(`${SPECIALIZATIONS}/by-department/${deptId}`),
  createSpecialization: (payload: SpecializationPayload) =>
    axios.post(SPECIALIZATIONS, payload),
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
