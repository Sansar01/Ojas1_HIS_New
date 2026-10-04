/**
 * Department feature service — hospital departments (masters).
 *
 *   GET    /api/hospital/masters/departments        fetchDepartments(params?)
 *   GET    /api/hospital/masters/departments/:id    fetchDepartmentById(id)
 *   POST   /api/hospital/masters/departments        createDepartment(payload)
 *   PATCH  /api/hospital/masters/departments/:id    updateDepartment(id, payload)
 *   DELETE /api/hospital/masters/departments/:id    deleteDepartment(id)
 *
 * Reference data used by patient registration, the doctor form, the
 * appointment form, the user form and the departments screens. Each screen
 * loads it through this service into its own local state.
 */

import { axios } from "@/api/axios";

const DEPARTMENTS = "/api/hospital/masters/departments";
const departmentPath = (id: string | number) => `${DEPARTMENTS}/${id}`;

export interface DepartmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  [key: string]: unknown;
}

/** Department write payload — the DTO as the form builds it. */
export type DepartmentPayload = Record<string, any>;

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const departmentService = {
  fetchDepartments: (params?: DepartmentQueryParams) =>
    axios.get(DEPARTMENTS, { params }),
  fetchDepartmentById: (id: string | number) => axios.get(departmentPath(id)),
  createDepartment: (payload: DepartmentPayload) =>
    axios.post(DEPARTMENTS, payload),
  updateDepartment: (id: string | number, payload: DepartmentPayload) =>
    axios.patch(departmentPath(id), payload),
  deleteDepartment: (id: string | number) => axios.delete(departmentPath(id)),
};
