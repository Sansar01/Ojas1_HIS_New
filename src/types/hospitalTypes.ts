/**
 * Hospital / facility model — the organisation profile used on invoices,
 * documents and the settings screens.
 */

export interface HospitalInfo {
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  currency: string;
  currencySymbol: string;
  invoicePrefix: string;
  defaultTaxRate: number;
  timezone: string;
  licenseNo: string;
}
