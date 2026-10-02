/**
 * Specialization slice — clinical specializations.
 *
 *   specializationSlice
 *       ├── items / status / error   (specializations-specific list state)
 *       ├── fetchSpecializations() / fetchSpecialization()
 *       ├── createSpecialization() / updateSpecialization() / deleteSpecialization()
 *       └── toggleSpecializationStatus()
 *
 * Uses the centralised specializations endpoints:
 *   API_ENDPOINTS.specializations.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
    createAsyncThunk,
    createSlice,
    type PayloadAction,
} from "@reduxjs/toolkit";
import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, Specialization, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): Specialization => raw as Specialization;

/* ------------------------------- thunks ---------------------------------- */

export const fetchSpecializations = createAsyncThunk(
    "specializations/fetchAll",
    async (_: void, { dispatch }) => {
        dispatch(showLoader("Loading"));
        try {
            const res = await apiClient<Specialization[]>(API_ENDPOINTS.specializations.list, {
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
            dispatch(toast.error("Could not load specializations", error?.message));
            throw error;
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            return state.specializations.status !== "loading";
        },
    },
);

export const fetchSpecialization = createAsyncThunk(
    "specializations/getOne",
    async (id: string, { dispatch }) => {
        dispatch(showLoader("Loading specializations record"));
        try {
            const res = await apiClient<Specialization>(API_ENDPOINTS.specializations.getById(id), {
                method: "GET",
            });
            dispatch(hideLoader());
            const responseData: any = (res as any)?.data ?? res;
            return map(responseData?.data ?? responseData?.item ?? responseData);
        } catch (error: any) {
            dispatch(hideLoader());
            dispatch(toast.error("Could not load specializations record", error?.message));
            throw error;
        }
    },
);

export const createSpecialization = createAsyncThunk(
    "specializations/create",
    async (payload: WritePayload<Specialization>, { dispatch }) => {
        dispatch(showLoader("Creating record"));
        try {
            const res = await apiClient<Specialization>(API_ENDPOINTS.specializations.create, {
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

export const updateSpecialization = createAsyncThunk(
    "specializations/update",
    async (
        payload: WritePayload<Specialization> & { id: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Saving changes"));
        try {
            const res = await apiClient<Specialization>(
                API_ENDPOINTS.specializations.update(payload.id),
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

export const deleteSpecialization = createAsyncThunk(
    "specializations/remove",
    async (
        payload: { id: string; label?: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Deleting record"));
        try {
            await apiClient(API_ENDPOINTS.specializations.delete(payload.id), {
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

export const toggleSpecializationStatus = createAsyncThunk(
    "specializations/toggleActive",
    async (
        payload: { id: string; status: Status; label?: string },
        { dispatch },
    ) => {
        try {
            const res = await apiClient<Specialization>(
                API_ENDPOINTS.specializations.update(payload.id),
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
            return res.data as Specialization;
        } catch (error: any) {
            dispatch(toast.error("Status change failed", error?.message));
            throw error;
        }
    },
);

/* -------------------------------- slice ---------------------------------- */

const specializationSlice = createSlice({
    name: "specializations",
    initialState: {
        items: [],
        status: "idle",
        saving: false,
        error: null,
        lastSync: null,
    } as CrudState<Specialization>,
    reducers: {
        patchSpecialization(s, action: PayloadAction<Partial<Specialization> & { id: string }>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
        },
        upsertSpecialization(s, action: PayloadAction<Specialization>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = action.payload;
            else s.items.unshift(action.payload);
        },
        removeSpecializationLocal(s, action: PayloadAction<string>) {
            s.items = s.items.filter((i) => i.id !== action.payload);
        },
        clearSpecializations(s) {
            s.items = [];
            s.status = "idle";
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSpecializations.pending, (s) => {
                s.status = "loading";
                s.error = null;
            })
            .addCase(fetchSpecializations.fulfilled, (s, action) => {
                s.status = "ready";
                s.items = action.payload as Specialization[];
                s.lastSync = new Date().toISOString();
            })
            .addCase(fetchSpecializations.rejected, (s, action) => {
                s.status = "error";
                s.error = (action.error.message as string) ?? "Request failed";
            })
            .addCase(fetchSpecialization.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as Specialization);
            })
            .addCase(createSpecialization.fulfilled, (s, action) => {
                s.items.unshift(action.payload as Specialization);
            })
            .addCase(updateSpecialization.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as Specialization);
            })
            .addCase(deleteSpecialization.fulfilled, (s, action) => {
                s.items = s.items.filter((i) => i.id !== action.payload);
            })
            .addCase(toggleSpecializationStatus.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
            });
    },
});

export const {
    patchSpecialization,
    upsertSpecialization,
    removeSpecializationLocal,
    clearSpecializations,
} = specializationSlice.actions;

export default specializationSlice.reducer;
