/**
 * Master-configuration domain models (departments master, global master
 * values, panels, services, tariffs).
 *
 * These are meaningful domain models used across the master-configuration
 * screens (their requests go through `api/apiClient.ts` + `api/endpoints.ts`).
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

export interface ServiceMasterItem {
  id: string;
  serviceCode: string;
  serviceName: string;
  category: ServiceCategory;
  baseRate: number | string;
  isActive: boolean;
}
/* ------------------------------ tariffs --------------------------------- */

export interface TariffMasterItem {
  id: string;
  tariffCode: string;
  tariffName: string;
  isActive: boolean;
  rates?: any[]; // Populated when getting by ID
}