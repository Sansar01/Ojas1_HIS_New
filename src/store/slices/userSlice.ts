/**
 * User slice — portal user accounts.
 *
 *   userSlice
 *       ├── items / status / error   (users-specific list state)
 *       ├── fetchUsers() / fetchUser()
 *       ├── createUser() / updateUser() / deleteUser()
 *       └── toggleUserStatus()
 *
 * Uses the centralised users endpoints:
 *   API_ENDPOINTS.users.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
    createAsyncThunk,
    createSlice,
    type PayloadAction,
} from "@reduxjs/toolkit";
import { userApi } from "@/api/userApi";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";
import { User } from "@/types/userTypes";

/** Raw API record → app shape. */
const map = (raw: any): User => raw as User;

/* ------------------------------- thunks ---------------------------------- */

export const fetchUsers = createAsyncThunk(
    "users/fetchAll",
    async (_: void, { dispatch }) => {
        dispatch(showLoader("Loading"));
        try {
            const res = await userApi.getAll();
            dispatch(hideLoader());

            const responseData = Array.isArray(res) ? res : (res as any).data;
            const rows = Array.isArray(responseData)
                ? responseData
                : (responseData?.rows ?? []);
            return rows.map(map);
        } catch (error: any) {
            dispatch(hideLoader());
            dispatch(toast.error("Could not load users", error?.message));
            throw error;
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            return state.users.status !== "loading";
        },
    },
);

export const fetchUser = createAsyncThunk(
    "users/getOne",
    async (id: string, { dispatch }) => {
        dispatch(showLoader("Loading users record"));
        try {
            const res = await userApi.getById(id);
            dispatch(hideLoader());
            const responseData: any = (res as any)?.data ?? res;
            return map(responseData?.data ?? responseData?.item ?? responseData);
        } catch (error: any) {
            dispatch(hideLoader());
            dispatch(toast.error("Could not load users record", error?.message));
            throw error;
        }
    },
);

export const createUser = createAsyncThunk(
    "users/create",
    async (payload: WritePayload<User>, { dispatch }) => {
        dispatch(showLoader("Creating record"));
        try {
            const res = await userApi.create(payload.data);
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

export const updateUser = createAsyncThunk(
    "users/update",
    async (
        payload: WritePayload<User> & { id: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Saving changes"));
        try {
            const res = await userApi.update(payload.id, payload.data);
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

export const deleteUser = createAsyncThunk(
    "users/remove",
    async (
        payload: { id: string; label?: string },
        { dispatch },
    ) => {
        dispatch(showLoader("Deleting record"));
        try {
            await userApi.remove(payload.id);
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

export const toggleUserStatus = createAsyncThunk(
    "users/toggleActive",
    async (
        payload: { id: string; status: Status; label?: string },
        { dispatch },
    ) => {
        try {
            const res = await userApi.update(payload.id, { status: payload.status });
            dispatch(
                toast.info(
                    payload.status === "active" ? "Marked active" : "Marked inactive",
                    payload.label
                        ? `${payload.label} is now ${payload.status}.`
                        : undefined,
                ),
            );
            return res.data as User;
        } catch (error: any) {
            dispatch(toast.error("Status change failed", error?.message));
            throw error;
        }
    },
);

/* -------------------------------- slice ---------------------------------- */

const userSlice = createSlice({
    name: "users",
    initialState: {
        items: [],
        status: "idle",
        saving: false,
        error: null,
        lastSync: null,
    } as CrudState<User>,
    reducers: {
        patchUser(s, action: PayloadAction<Partial<User> & { id: string }>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
        },
        upsertUser(s, action: PayloadAction<User>) {
            const index = s.items.findIndex((i) => i.id === action.payload.id);
            if (index > -1) s.items[index] = action.payload;
            else s.items.unshift(action.payload);
        },
        removeUserLocal(s, action: PayloadAction<string>) {
            s.items = s.items.filter((i) => i.id !== action.payload);
        },
        clearUsers(s) {
            s.items = [];
            s.status = "idle";
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUsers.pending, (s) => {
                s.status = "loading";
                s.error = null;
            })
            .addCase(fetchUsers.fulfilled, (s, action) => {
                s.status = "ready";
                s.items = action.payload as User[];
                s.lastSync = new Date().toISOString();
            })
            .addCase(fetchUsers.rejected, (s, action) => {
                s.status = "error";
                s.error = (action.error.message as string) ?? "Request failed";
            })
            .addCase(fetchUser.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as User);
            })
            .addCase(createUser.fulfilled, (s, action) => {
                s.items.unshift(action.payload as User);
            })
            .addCase(updateUser.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
                else s.items.unshift(action.payload as User);
            })
            .addCase(deleteUser.fulfilled, (s, action) => {
                s.items = s.items.filter((i) => i.id !== action.payload);
            })
            .addCase(toggleUserStatus.fulfilled, (s, action) => {
                const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
                if (index > -1)
                    s.items[index] = { ...s.items[index], ...(action.payload as any) };
            });
    },
});

export const {
    patchUser,
    upsertUser,
    removeUserLocal,
    clearUsers,
} = userSlice.actions;

export default userSlice.reducer;
