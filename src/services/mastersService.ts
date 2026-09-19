import { request } from "@/services/apiClient";
import { API_ENDPOINTS } from "@/config/api";

/**
 * Generic master-data service.
 * The active Global Configuration tab supplies `type` through
 * MasterDef.api. API_ENDPOINTS resolves it to /api/hospital/masters/:type.
 */

/** A row from the admin-managed DepartmentType master. */
export interface DepartmentTypeRecord {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  isSystem?: boolean;
}

export interface MasterRecord {
  id: number | string;
  /** Optional — stays NULL when the user leaves it blank. */
  code?: string | null;
  name: string;
  description?: string | null;
  /** FK to the DepartmentType master. */
  typeId?: number | null;
  /** Relation, included by the backend on list/detail responses. */
  type?: DepartmentTypeRecord | null;
  sortOrder?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

const base = (type: string) => API_ENDPOINTS.masters(type);

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
