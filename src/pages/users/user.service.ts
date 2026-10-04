/**
 * User feature service — staff accounts (users module).
 *
 *   GET    /api/hospital/users          fetchUsers(params?)
 *   GET    /api/hospital/users/:id      fetchUserById(id)
 *   POST   /api/hospital/users          createUser(payload)
 *   PATCH  /api/hospital/users/:id      updateUser(id, payload)
 *   DELETE /api/hospital/users/:id      deleteUser(id)
 *
 * Used by the users list / create screens and the admin pages; results live in
 * page state (there is no `userSlice` any more).
 */

import { axios } from "@/api/axios";

const USERS = "/api/hospital/users";
const userPath = (id: string | number) => `${USERS}/${id}`;

export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string | number;
  departmentId?: string | number;
  [key: string]: unknown;
}

/** User write payload — the DTO as the create/edit form builds it. */
export type UserPayload = Record<string, any>;

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const userService = {
  fetchUsers: (params?: UserQueryParams) => axios.get(USERS, { params }),
  fetchUserById: (id: string | number) => axios.get(userPath(id)),
  createUser: (payload: UserPayload) => axios.post(USERS, payload),
  updateUser: (id: string | number, payload: UserPayload) =>
    axios.patch(userPath(id), payload),
  deleteUser: (id: string | number) => axios.delete(userPath(id)),
};
