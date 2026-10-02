/**
 * Activity slice — activity / audit log.
 *
 *   activitySlice
 *       ├── items / status / error   (activities-specific list state)
 *       ├── fetchActivities() / fetchActivity()
 *       ├── createActivity() / updateActivity() / deleteActivity()
 *       └── toggleActivityStatus()
 *
 * Uses the centralised activities endpoints:
 *   API_ENDPOINTS.activities.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
    createAsyncThunk,
    createSlice,
    type PayloadAction,
} from "@reduxjs/toolkit";
import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, ActivityLog, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): ActivityLog => raw as ActivityLog;

/* ------------------------------- thunks ---------------------------------- */

export const fetchActivities = createAsyncThunk(
    "activities/fetchAll",
    async (_: void, { dispatch }) => {
        dispatch(showLoader("Loading"));
        try {
            const res = await apiClient<ActivityLog[]>(API_ENDPOINTS.activities.list, {
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
            dispatch(toast.error("Could not load activities", error?.message));
            throw error;
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            return state.activities.status !== "loading";
        },
    },
);

export const fetchActivity = createAsyncThunk(
    "activities/getOne",
    async (id: string, { dispatch }) => {
        dispatch(showLoader("Loading activities record"));
        try {
            const res = await apiClient<ActivityLog>(API_ENDPOINTS.activities.getById(id), {
                method: "GET",
            });
            dispatch(hideLoader());
            const responseData: any = (res as any)?.data ?? res;
            return map(responseData?.data ?? responseData?.item ?? responseData);
        } catch (error: any) {
            dispatch(hideLoader());
            dispatch(toast.error("Could not load activities record", error?.message));
            throw error;
        }
    },
);

export const createActivity = createAsyncThunk(
    "activities/create",
    async (payload: WritePayload<ActivityLog>, { dispatch }) => {
        dispatch(showLoader("Creating record"));
        try {
            const res = await apiClient<ActivityLog>(API_ENDPOINTS.activities.create, {
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

export const updateActivity = createAsyncThunk(
    "activities/update",
    async (
        payload: WritePayload<ActivityLog> & { id: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Saving changes"));
        try {
            const res = await apiClient<ActivityLog>(
                API_ENDPOINTS.activities.update(payload.id),
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

export const deleteActivity = createAsyncThunk(
    "activities/remove",
    async (
        payload: { id: string; label?: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Deleting record"));
        try {
            await apiClient(API_ENDPOINTS.activities.delete(payload.id), {
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

export const toggleActivityStatus = createAsyncThunk(
    "activities/toggleActive",
    async (
        payload: { id: string; status: Status; label?: string },
        { dispatch },
    ) => {
        try {
            const res = await apiClient<ActivityLog>(
                API_ENDPOINTS.activities.update(payload.id),
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
            return res.data as ActivityLog;
        } catch (error: any) {
            dispatch(toast.error("Status change failed", error?.message));
            throw error;
        }
    },
);

/* -------------------------------- slice ---------------------------------- */

const activitySlice = createSlice({
    name: "activities",
    initialState: {
        items: [],
        status: "idle",
        saving: false,
        error: null,
        lastSync: null,
    } as CrudState<ActivityLog>,
    reducers: {
        patchActivity(s, action: PayloadAction<Partial<ActivityLog> & { id: string }>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
        },
        upsertActivity(s, action: PayloadAction<ActivityLog>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = action.payload;
            else s.items.unshift(action.payload);
        },
        removeActivityLocal(s, action: PayloadAction<string>) {
            s.items = s.items.filter((i) => i.id !== action.payload);
        },
        clearActivities(s) {
            s.items = [];
            s.status = "idle";
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchActivities.pending, (s) => {
                s.status = "loading";
                s.error = null;
            })
            .addCase(fetchActivities.fulfilled, (s, action) => {
                s.status = "ready";
                s.items = action.payload as ActivityLog[];
                s.lastSync = new Date().toISOString();
            })
            .addCase(fetchActivities.rejected, (s, action) => {
                s.status = "error";
                s.error = (action.error.message as string) ?? "Request failed";
            })
            .addCase(fetchActivity.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as ActivityLog);
            })
            .addCase(createActivity.fulfilled, (s, action) => {
                s.items.unshift(action.payload as ActivityLog);
            })
            .addCase(updateActivity.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as ActivityLog);
            })
            .addCase(deleteActivity.fulfilled, (s, action) => {
                s.items = s.items.filter((i) => i.id !== action.payload);
            })
            .addCase(toggleActivityStatus.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
            });
    },
});

export const {
    patchActivity,
    upsertActivity,
    removeActivityLocal,
    clearActivities,
} = activitySlice.actions;

export default activitySlice.reducer;
