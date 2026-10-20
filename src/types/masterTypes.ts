/**
 * Master-configuration domain models (departments master, global master
 * values, panels, services, tariffs).
 *
 * These are meaningful domain models used across the master-configuration
 * screens (their requests go through `pages/masterConfiguration/master.service.ts`).
 */

/* --------------------------- global master ------------------------------- */

export type MasterCategory =
  | "PANEL_BILLING"
  | "CLINICAL"
  | "INVENTORY"
  | "GENERAL";

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

/* ------------------------------ panels ---------------------------------- */

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

/* ------------------------------ services -------------------------------- */

export type ServiceCategory =
  | "CONSULTATION"
  | "LAB"
  | "RADIOLOGY"
  | "PROCEDURE"
  | "PHARMACY"
  | "BED_CHARGE"
  | "OTHER";

/**
 * A service category as the relational catalogue returns it
 * (GET /api/hospital/masters/service-categories).
 */
export interface ServiceCategoryItem {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/**
 * `itemType` of a service item — MANDATORY on create; backend enum:
 * BOTH | OPD | IPD | DAYCARE | PACKAGE.
 */
export type ServiceItemType = "BOTH" | "OPD" | "IPD" | "DAYCARE" | "PACKAGE";

/**
 * A catalogue entry from the relational service catalogue
 * (GET/POST /api/hospital/masters/service-items).
 */
export interface ServiceItem {
  id: string;
  serviceCode: string;
  serviceName: string;
  categoryId: string;
  /** Joined category record (name rendered in the table/chips). */
  categoryRel?: Pick<ServiceCategoryItem, "id" | "name"> | null;
  baseRate: number | string;
  itemType?: ServiceItemType | string;
  rateEditable?: boolean;
  discountable?: boolean;
  isActive?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** Legacy flat catalogue entry (GET /api/hospital/masters/services). */
export interface ServiceMasterItem {
  id: string;
  serviceCode: string;
  serviceName: string;
  category: ServiceCategory;
  baseRate: number | string;
  isActive: boolean;
  /** Audit fields the services API also returns (optional — list tolerates older shapes). */
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}
/* ------------------------- doctor management masters ---------------------- */

/** A clinical department (GET/POST /api/hospital/masters/clinical-departments). */
export interface ClinicalDepartmentItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** A doctor specialization (GET/POST /api/hospital/masters/specializations). */
export interface SpecializationMasterItem {
  id: string;
  clinicalDepartmentId: string;
  name: string;
  code: string;
  /** Joined department record when the API includes it. */
  clinicalDepartment?: Pick<ClinicalDepartmentItem, "id" | "name"> | null;
  isActive?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/* ------------------------- lab / specimen masters ------------------------ */

/** Backend enum of a lab department's discipline. */
export type LabDepartmentType =
  | "BIOCHEMISTRY"
  | "HEMATOLOGY"
  | "MICROBIOLOGY"
  | "PATHOLOGY"
  | "SEROLOGY"
  | "RADIOLOGY"
  | "CARDIOLOGY"
  | "NUCLEAR_MEDICINE"
  | "OTHER";

/** A lab department (GET/POST /api/hospital/masters/lab-departments). */
export interface LabDepartmentItem {
  id: string;
  code: string;
  name: string;
  departmentType: LabDepartmentType | string;
  turnaroundHours: number | string;
  allowTemplates?: boolean;
  isActive?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** A sample container (GET /api/hospital/masters/sample-containers). */
export interface SampleContainerItem {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** Storage temperature enum of a sample type. */
export type StorageTemp =
  | "ROOM_TEMPERATURE"
  | "REFRIGERATED"
  | "FROZEN"
  | "DEEP_FROZEN";

/** A sample/specimen type (GET/POST /api/hospital/masters/sample-types). */
export interface SampleTypeItem {
  id: string;
  code: string;
  name: string;
  defaultContainerId?: string | null;
  /** Joined container record when the API includes it. */
  defaultContainer?: Pick<SampleContainerItem, "id" | "name"> | null;
  storageTemp?: StorageTemp | string | null;
  minVolumeMl?: number | string | null;
  isActive?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** An investigation (GET/POST /api/hospital/masters/investigations). */
export interface InvestigationItem {
  id: string;
  code: string;
  name: string;
  labDepartmentId: string;
  /** Joined department record when the API includes it. */
  labDepartment?: Pick<LabDepartmentItem, "id" | "name"> | null;
  sampleTypeId: string;
  /** Joined sample-type record when the API includes it. */
  sampleType?: Pick<SampleTypeItem, "id" | "name"> | null;
  reportingFormat?: string | null;
  outsourceTatHours?: number | string | null;
  isActive?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/* ------------------------------ tariffs --------------------------------- */

export interface TariffMasterItem {
  id: string;
  tariffCode: string;
  tariffName: string;
  isActive: boolean;
  /** Audit fields the tariffs API also returns (optional — list tolerates older shapes). */
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  /** Rate-row counter the list API includes (`_count.rates`). */
  _count?: { rates: number };
  rates?: any[]; // Populated when getting by ID
}