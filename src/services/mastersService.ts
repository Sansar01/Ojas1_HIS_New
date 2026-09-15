import { request } from "@/services/apiClient";

/**
 * Generic master-data service.
 * One endpoint convention for every master: /api/hospital/masters/:type
 * The `type` comes from MasterDef.api in masterConfig.data.ts.
 */

export interface MasterRecord {
  id: string;
  code?: string;
  name: string;
  isActive: boolean;
  sortOrder?: number;
  [key: string]: unknown;
}

const base = (type: string) => `/api/hospital/masters/${type}`;

export const mastersService = {
  list: (type: string) =>
    request<MasterRecord[] | { data: MasterRecord[] }>({
      url: base(type),
      method: "GET",
    }),

  create: (type: string, body: Partial<MasterRecord>) =>
    request<MasterRecord>({ url: base(type), method: "POST", body }),

  update: (type: string, id: string, body: Partial<MasterRecord>) =>
    request<MasterRecord>({ url: `${base(type)}/${id}`, method: "PATCH", body }),

  /** Soft delete — masters are never hard-deleted, history references them. */
  setActive: (type: string, id: string, isActive: boolean) =>
    request<MasterRecord>({
      url: `${base(type)}/${id}`,
      method: "PATCH",
      body: { isActive },
    }),
};
