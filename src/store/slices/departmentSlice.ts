/**
 * Department slice — organisation departments.
 *
 *   departmentSlice
 *       ├── items / status / error   (departments-specific list state)
 *       ├── fetchDepartments() / fetchDepartment()
 *       ├── createDepartment() / updateDepartment() / deleteDepartment()
 *       └── toggleDepartmentStatus()
 *
 * Uses the centralised departments endpoints:
 *   API_ENDPOINTS.departments.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
    createAsyncThunk,
    createSlice,
    type PayloadAction,
} from "@reduxjs/toolkit";
import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, Department, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): Department => raw as Department;

/* ------------------------------- thunks ---------------------------------- */

export const fetchDepartments = createAsyncThunk(
    "departments/fetchAll",
    async (_: void, { dispatch }) => {
        dispatch(showLoader("Loading"));
        try {
            const res = await apiClient<Department[]>(API_ENDPOINTS.departments.list, {
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
            dispatch(toast.error("Could not load departments", error?.message));
            throw error;
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            return state.departments.status !== "loading";
        },
    },
);

export const fetchDepartment = createAsyncThunk(
    "departments/getOne",
    async (id: string, { dispatch }) => {
        dispatch(showLoader("Loading departments record"));
        try {
            const res = await apiClient<Department>(API_ENDPOINTS.departments.getById(id), {
                method: "GET",
            });
            dispatch(hideLoader());
            const responseData: any = (res as any)?.data ?? res;
            return map(responseData?.data ?? responseData?.item ?? responseData);
        } catch (error: any) {
            dispatch(hideLoader());
            dispatch(toast.error("Could not load departments record", error?.message));
            throw error;
        }
    },
);

export const createDepartment = createAsyncThunk(
    "departments/create",
    async (payload: WritePayload<Department>, { dispatch }) => {
        dispatch(showLoader("Creating record"));
        try {
            const res = await apiClient<Department>(API_ENDPOINTS.departments.create, {
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

export const updateDepartment = createAsyncThunk(
    "departments/update",
    async (
        payload: WritePayload<Department> & { id: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Saving changes"));
        try {
            const res = await apiClient<Department>(
                API_ENDPOINTS.departments.update(payload.id),
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

export const deleteDepartment = createAsyncThunk(
    "departments/remove",
    async (
        payload: { id: string; label?: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Deleting record"));
        try {
            await apiClient(API_ENDPOINTS.departments.delete(payload.id), {
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

export const toggleDepartmentStatus = createAsyncThunk(
    "departments/toggleActive",
    async (
        payload: { id: string; status: Status; label?: string },
        { dispatch },
    ) => {
        try {
            const res = await apiClient<Department>(
                API_ENDPOINTS.departments.update(payload.id),
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
            return res.data as Department;
        } catch (error: any) {
            dispatch(toast.error("Status change failed", error?.message));
            throw error;
        }
    },
);

/* -------------------------------- slice ---------------------------------- */

const departmentSlice = createSlice({
    name: "departments",
    initialState: {
        items: [],
        status: "idle",
        saving: false,
        error: null,
        lastSync: null,
    } as CrudState<Department>,
    reducers: {
        patchDepartment(s, action: PayloadAction<Partial<Department> & { id: string }>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
        },
        upsertDepartment(s, action: PayloadAction<Department>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = action.payload;
            else s.items.unshift(action.payload);
        },
        removeDepartmentLocal(s, action: PayloadAction<string>) {
            s.items = s.items.filter((i) => i.id !== action.payload);
        },
        clearDepartments(s) {
            s.items = [];
            s.status = "idle";
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDepartments.pending, (s) => {
                s.status = "loading";
                s.error = null;
            })
            .addCase(fetchDepartments.fulfilled, (s, action) => {
                s.status = "ready";
                s.items = action.payload as Department[];
                s.lastSync = new Date().toISOString();
            })
            .addCase(fetchDepartments.rejected, (s, action) => {
                s.status = "error";
                s.error = (action.error.message as string) ?? "Request failed";
            })
            .addCase(fetchDepartment.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as Department);
            })
            .addCase(createDepartment.fulfilled, (s, action) => {
                s.items.unshift(action.payload as Department);
            })
            .addCase(updateDepartment.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as Department);
            })
            .addCase(deleteDepartment.fulfilled, (s, action) => {
                s.items = s.items.filter((i) => i.id !== action.payload);
            })
            .addCase(toggleDepartmentStatus.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
            });
    },
});

export const {
    patchDepartment,
    upsertDepartment,
    removeDepartmentLocal,
    clearDepartments,
} = departmentSlice.actions;

export default departmentSlice.reducer;
