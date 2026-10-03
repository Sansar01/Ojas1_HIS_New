/**
 * Role slice — hospital RBAC roles.
 *
 *   roleSlice
 *       ├── items / status / error   (roles-specific list state)
 *       ├── fetchRoles() / fetchRole()
 *       ├── createRole() / updateRole() / deleteRole()
 *       └── toggleRoleStatus()
 *
 * Uses the centralised roles endpoints:
 *   API_ENDPOINTS.roles.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type {
  CrudState,
  Role,
  RoleMasterCatalogItem,
  RolePermissionAssignment,
  Status,
  WritePayload,
} from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): Role => raw as Role;

/* ------------------------------- thunks ---------------------------------- */

export const fetchRoles = createAsyncThunk(
  "roles/fetchAll",
  async (_force: boolean | void, { dispatch }) => {
    dispatch(showLoader("Loading"));
    try {
      const res = await apiClient<Role[]>(API_ENDPOINTS.roles.list, {
        method: "GET",
      });
      dispatch(hideLoader());

      const responseData = Array.isArray(res) ? res : (res as any).data;
      const rows = Array.isArray(responseData)
        ? responseData
        : (responseData?.rows ?? []);
      return rows.map(map);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load roles", error?.message));
      throw error;
    }
  },
  {
    condition: (force, { getState }) => {
      const state = getState() as RootState;
      return Boolean(force) || state.roles.status !== "loading";
    },
  },
);

export const fetchRole = createAsyncThunk(
  "roles/getOne",
  async (id: string, { dispatch }) => {
    dispatch(showLoader("Loading roles record"));
    try {
      const res = await apiClient<Role>(API_ENDPOINTS.roles.getById(id), {
        method: "GET",
      });
      dispatch(hideLoader());
      const responseData: any = (res as any)?.data ?? res;
      return map(responseData?.data ?? responseData?.item ?? responseData);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load roles record", error?.message));
      throw error;
    }
  },
);

export const createRole = createAsyncThunk(
  "roles/create",
  async (payload: WritePayload<Role>, { dispatch }) => {
    dispatch(showLoader("Creating record"));
    try {
      const res = await apiClient<Role>(API_ENDPOINTS.roles.create, {
        method: "POST",
        body: payload.data,
      });
      dispatch(hideLoader());
      dispatch(toast.success(payload.successMessage ?? "Record created"));
      return map((res as any).data ?? res);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Creation failed", error?.message));
      throw error;
    }
  },
);

export const updateRole = createAsyncThunk(
  "roles/update",
  async (
    payload: WritePayload<Role> & { id: string },
    { dispatch },
  ) => {
    dispatch(showLoader("Saving changes"));
    try {
      const res = await apiClient<Role>(
        API_ENDPOINTS.roles.update(payload.id),
        { method: "PATCH", body: payload.data },
      );
      dispatch(hideLoader());
      dispatch(toast.success(payload.successMessage ?? "Changes saved"));
      return map((res as any).data ?? res);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Update failed", error?.message));
      throw error;
    }
  },
);

export const deleteRole = createAsyncThunk(
  "roles/remove",
  async (
    payload: { id: string; label?: string },
    { dispatch },
  ) => {
    dispatch(showLoader("Deleting record"));
    try {
      await apiClient(API_ENDPOINTS.roles.delete(payload.id), {
        method: "DELETE",
      });
      dispatch(hideLoader());
      dispatch(
        toast.success(
          "Record deleted",
          payload.label
            ? `${payload.label} was removed from the portal.`
            : undefined,
        ),
      );
      return payload.id;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Delete failed", error?.message));
      throw error;
    }
  },
);

export const toggleRoleStatus = createAsyncThunk(
  "roles/toggleActive",
  async (
    payload: { id: string; status: Status; label?: string },
    { dispatch },
  ) => {
    try {
      const res = await apiClient<Role>(
        API_ENDPOINTS.roles.update(payload.id),
        { method: "PATCH", body: { status: payload.status } },
      );
      dispatch(
        toast.info(
          payload.status === "active" ? "Marked active" : "Marked inactive",
          payload.label
            ? `${payload.label} is now ${payload.status}.`
            : undefined,
        ),
      );
      return res.data as Role;
    } catch (error: any) {
      dispatch(toast.error("Status change failed", error?.message));
      throw error;
    }
  },
);

/* -------------------------------- slice ---------------------------------- */

const roleSlice = createSlice({
  name: "roles",
  initialState: {
    items: [],
    status: "idle",
    saving: false,
    error: null,
    lastSync: null,
    rolesRequestId: null,
  } as CrudState<Role> & { rolesRequestId: string | null },
  reducers: {
    patchRole(s, action: PayloadAction<Partial<Role> & { id: string }>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
    },
    upsertRole(s, action: PayloadAction<Role>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = action.payload;
      else s.items.unshift(action.payload);
    },
    removeRoleLocal(s, action: PayloadAction<string>) {
      s.items = s.items.filter((i) => i.id !== action.payload);
    },
    clearRoles(s) {
      s.items = [];
      s.status = "idle";
      s.rolesRequestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (s, action) => {
        s.status = "loading";
        s.error = null;
        s.rolesRequestId = action.meta.requestId;
      })
      .addCase(fetchRoles.fulfilled, (s, action) => {
        if (s.rolesRequestId !== action.meta.requestId) return;
        s.status = "ready";
        s.items = action.payload as Role[];
        s.lastSync = new Date().toISOString();
        s.rolesRequestId = null;
      })
      .addCase(fetchRoles.rejected, (s, action) => {
        if (s.rolesRequestId !== action.meta.requestId) return;
        s.status = "error";
        s.error = (action.error.message as string) ?? "Request failed";
        s.rolesRequestId = null;
      })
      .addCase(fetchRole.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Role);
      })
      .addCase(createRole.fulfilled, (s, action) => {
        s.items.unshift(action.payload as Role);
      })
      .addCase(updateRole.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Role);
      })
      .addCase(deleteRole.fulfilled, (s, action) => {
        s.items = s.items.filter((i) => i.id !== action.payload);
      })
      .addCase(toggleRoleStatus.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
      });
  },
});

export const {
  patchRole,
  upsertRole,
  removeRoleLocal,
  clearRoles,
} = roleSlice.actions;

export default roleSlice.reducer;

/* ----------------------- role catalogue & permissions --------------------- */

/**
 * Fetch the system role catalogue offered when creating a hospital role.
 */
export const fetchRoleMasterCatalog = createAsyncThunk(
  "roles/fetchMasterCatalog",
  async (_, { rejectWithValue }) => {
    try {
      const response: any = await apiClient(
        API_ENDPOINTS.roles.masterCatalog,
        { method: "GET" },
      );
      const data = response?.data ?? response;
      return (Array.isArray(data) ? data : data?.rows ??
        []) as RoleMasterCatalogItem[];
    } catch (error: any) {
      return rejectWithValue(error?.message ?? "Could not load role catalog");
    }
  },
);

/**
 * Create a role from the master catalogue (or a custom name/code).
 */
export const createHospitalRole = createAsyncThunk(
  "roles/createHospitalRole",
  async (
    payload: {
      roleNameId?: number;
      roleName?: string;
      roleCode?: string;
      description: string;
    },
    { dispatch, rejectWithValue },
  ) => {
    dispatch(showLoader("Creating role"));
    try {
      const response = await apiClient(API_ENDPOINTS.roles.create, {
        method: "POST",
        body: payload,
      });
      dispatch(hideLoader());
      dispatch(toast.success("Role created"));
      return (response as any).data;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not create role", error?.message));
      return rejectWithValue(error?.message ?? "Role creation failed");
    }
  },
);

/**
 * Replace the module/feature assignments of one role.
 */
export const updateRolePermissions = createAsyncThunk(
  "roles/updatePermissions",
  async (
    payload: {
      roleId: string;
      moduleFeatures: Array<{ moduleId: number; featureId: number }>;
      successMessage?: string;
    },
    { dispatch, rejectWithValue },
  ) => {
    dispatch(showLoader("Saving role permissions"));
    try {
      const response = await apiClient(
        API_ENDPOINTS.permissions.byRole(payload.roleId),
        {
          method: "PUT",
          body: { moduleFeatures: payload.moduleFeatures },
        },
      );
      dispatch(hideLoader());
      dispatch(
        toast.success(payload.successMessage ?? "Role permissions updated"),
      );
      return (response as any).data;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(
        toast.error("Could not update role permissions", error?.message),
      );
      return rejectWithValue(error?.message ?? "Permission update failed");
    }
  },
);

/**
 * Load the module/feature assignments of one role.
 */
export const fetchRolePermissions = createAsyncThunk(
  "roles/fetchPermissions",
  async (roleId: string, { rejectWithValue }) => {
    try {
      const response: any = await apiClient(
        API_ENDPOINTS.permissions.byRole(roleId),
        { method: "GET" },
      );
      const data = response?.data ?? response;
      return (Array.isArray(data) ? data : data?.rows ??
        []) as RolePermissionAssignment[];
    } catch (error: any) {
      return rejectWithValue(error?.message ?? "Could not load role permissions");
    }
  },
);
