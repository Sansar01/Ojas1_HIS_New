import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { resourceApi } from "@/services/apiClient";
import { API_ENDPOINTS } from "@/config/api";
import { hideLoader, showLoader, toast } from "@/features/ui/uiSlice";
import type { ListQuery, Status } from "@/types";

/* ---------------------------------------------------------------------------
 * Generic CRUD slice factory — keeps every module modular, typed and ready
 * for a real backend (same thunk shapes, same envelope, same loading rules).
 * ------------------------------------------------------------------------ */

export interface CrudState<T = any> {
  items: T[];
  status: "idle" | "loading" | "ready" | "error";
  saving: boolean;
  error: string | null;
  lastSync: string | null;
}

export interface CrudConfig<T> {
  name: string;
  resource: keyof typeof API_ENDPOINTS;
  listParams?: ListQuery | null;
  /** wire global loader + toasts to API lifecycle (default true) */
  imperative?: boolean;
  initialValue?: T[];
}

export interface WritePayload<T> {
  data: Partial<T> & { id?: string };
  successMessage?: string;
}

export interface ListPayload {
  search?: string;
  filters?: Record<string, string>;
}

export function createCrudSlice<T extends { id: string }>(
  config: CrudConfig<T>,
) {
  const { name, resource, imperative = true } = config;

  const guard = (dispatch: (a: any) => unknown, label: string) => {
    if (imperative) dispatch(showLoader(label));
    return () => {
      if (imperative) dispatch(hideLoader());
    };
  };

  const fetchAll = createAsyncThunk(
    `${name}/fetchAll`,
    async (_: void, { dispatch }) => {
      const done = guard(dispatch, `Loading ${name}`);
      try {
        const res = await resourceApi.list(
          resource,
          config.listParams === null
            ? undefined
            : config.listParams ?? { pageSize: 1000 },
        );
        done();
        const responseData = Array.isArray(res) ? res : res.data;
        return (Array.isArray(responseData)
          ? responseData
          : responseData?.rows ?? []) as T[];
      } catch (error: any) {
        done();
        dispatch(toast.error(`Could not load ${name}`, error?.message));
        throw error;
      }
    },
  );

  const createOne = createAsyncThunk(
    `${name}/create`,
    async (payload: WritePayload<T>, { dispatch }) => {
      const done = guard(dispatch, "Creating record");
      try {
        const res = await resourceApi.create(resource, payload.data);
        done();
        dispatch(toast.success(payload.successMessage ?? "Record created"));
        return res.data as T;
      } catch (error: any) {
        done();
        dispatch(toast.error("Creation failed", error?.message));
        throw error;
      }
    },
  );

  const updateOne = createAsyncThunk(
    `${name}/update`,
    async (payload: WritePayload<T> & { id: string }, { dispatch }) => {
      const done = guard(dispatch, "Saving changes");
      try {
        const res = await resourceApi.update(
          resource,
          payload.id,
          payload.data,
        );
        done();
        dispatch(toast.success(payload.successMessage ?? "Changes saved"));
        return res.data as T;
      } catch (error: any) {
        done();
        dispatch(toast.error("Update failed", error?.message));
        throw error;
      }
    },
  );

  const removeOne = createAsyncThunk(
    `${name}/remove`,
    async (payload: { id: string; label?: string }, { dispatch }) => {
      const done = guard(dispatch, "Deleting record");
      try {
        await resourceApi.remove(resource, payload.id);
        done();
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
        done();
        dispatch(toast.error("Delete failed", error?.message));
        throw error;
      }
    },
  );

  const toggleActive = createAsyncThunk(
    `${name}/toggleActive`,
    async (
      payload: { id: string; status: Status; label?: string },
      { dispatch },
    ) => {
      try {
        const res = await resourceApi.update(resource, payload.id, {
          status: payload.status,
        });
        dispatch(
          toast.info(
            payload.status === "active" ? "Marked active" : "Marked inactive",
            payload.label
              ? `${payload.label} is now ${payload.status}.`
              : undefined,
          ),
        );
        return res.data as T;
      } catch (error: any) {
        dispatch(toast.error("Status change failed", error?.message));
        throw error;
      }
    },
  );

  const slice = createSlice({
    name,
    initialState: {
      items: config.initialValue ?? [],
      status: "idle",
      saving: false,
      error: null,
      lastSync: null,
    } as CrudState,
    reducers: {
      patchItem(s, action: PayloadAction<Partial<T> & { id: string }>) {
        const index = s.items.findIndex((i: any) => i.id === action.payload.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
      },
      upsertItem(s, action: PayloadAction<T>) {
        const index = s.items.findIndex(
          (i: any) => i.id === (action.payload as any).id,
        );
        if (index > -1) s.items[index] = action.payload as any;
        else s.items.unshift(action.payload as any);
      },
      removeItem(s, action: PayloadAction<string>) {
        s.items = s.items.filter((i: any) => i.id !== action.payload);
      },
      clearAll(s) {
        s.items = [];
        s.status = "idle";
      },
    },
    extraReducers: (builder) => {
      builder
        .addCase(fetchAll.pending, (s) => {
          s.status = "loading";
          s.error = null;
        })
        .addCase(fetchAll.fulfilled, (s, action) => {
          s.status = "ready";
          s.items = action.payload as any[];
          s.lastSync = new Date().toISOString();
        })
        .addCase(fetchAll.rejected, (s, action) => {
          s.status = "error";
          s.error = (action.error.message as string) ?? "Request failed";
        })
        .addCase(createOne.fulfilled, (s, action) => {
          s.items.unshift(action.payload as any);
        })
        .addCase(updateOne.fulfilled, (s, action) => {
          const index = s.items.findIndex(
            (i: any) => i.id === (action.payload as any).id,
          );
          if (index > -1)
            s.items[index] = { ...s.items[index], ...(action.payload as any) };
          else s.items.unshift(action.payload as any);
        })
        .addCase(removeOne.fulfilled, (s, action) => {
          s.items = s.items.filter((i: any) => i.id !== action.payload);
        })
        .addCase(toggleActive.fulfilled, (s, action) => {
          const index = s.items.findIndex(
            (i: any) => i.id === (action.payload as any).id,
          );
          if (index > -1)
            s.items[index] = { ...s.items[index], ...(action.payload as any) };
        });
    },
  });

  return {
    name,
    resource,
    reducer: slice.reducer,
    actions: slice.actions,
    thunks: { fetchAll, createOne, updateOne, removeOne, toggleActive },
  };
}

export type CrudApi<T extends { id: string }> = ReturnType<
  typeof createCrudSlice<T>
>;
