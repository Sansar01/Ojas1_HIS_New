/**
 * Master slice — shared master/reference data and its request lifecycle.
 *
 *   masterSlice
 *       ├── services   (masters.services.list — Service Master + Tariff Master)
 *       ├── tariffs    (masters.tariffs.list  — Tariff Master + Panel form)
 *       └── dropdowns  (global masters / panel / tariff reference lists)
 *
 * Doc §21 (Master Data Rule): reference data used by several screens follows
 *
 *   Backend → Master/Domain API (`masterApi`) → Redux → multiple forms/pages
 *
 * Every entry is guarded the same way (§13, §16): the component just dispatches
 * the fetch, and the thunk decides whether a request is needed —
 *
 *   loading   → stop            (StrictMode / second component mounts)
 *   ready     → reuse           (the cache is per session)
 *   idle/error→ request
 *   force     → request         (explicit manual refresh after a write)
 *
 * Datasets that only one screen ever reads stay page-local through `masterApi`
 * (§26 explicitly allows that, e.g. the global master table and a tariff's rate
 * matrix); this slice is only for what more than one screen shares.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { masterApi } from "@/api/masterApi";
import { toast } from "./uiSlice";
import type { RootState } from "@/store/types";

/** Reference lists that forms across the app ask for. */
export type MasterDropdownKey =
  | "GROUP_TYPE"
  | "PAYMENT_MODE"
  | "PANEL_TYPE"
  | "CURRENCY"
  | "PANELS"
  | "TARIFFS";

const DROPDOWN_SOURCES: Record<MasterDropdownKey, () => Promise<any>> = {
  GROUP_TYPE: () => masterApi.globalDropdown("GROUP_TYPE"),
  PAYMENT_MODE: () => masterApi.globalDropdown("PAYMENT_MODE"),
  PANEL_TYPE: () => masterApi.globalDropdown("PANEL_TYPE"),
  CURRENCY: () => masterApi.globalDropdown("CURRENCY"),
  PANELS: () => masterApi.panelDropdown(),
  TARIFFS: () => masterApi.tariffDropdown(),
};

interface Collection {
  items: any[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

export interface MasterState {
  services: Collection;
  tariffs: Collection;
  dropdowns: Partial<Record<MasterDropdownKey, Collection>>;
}

const empty = (): Collection => ({ items: [], status: "idle", error: null });

const initialState: MasterState = {
  services: empty(),
  tariffs: empty(),
  dropdowns: {},
};

/** Both endpoints answer either with a bare array or a `{ data: [...] }` envelope. */
const rowsOf = (res: any): any[] =>
  Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];

/* ------------------------------- thunks ---------------------------------- */

/** Service catalogue — read by Service Master and the Tariff rate matrix. */
export const fetchServices = createAsyncThunk(
  "master/fetchServices",
  async (_force: boolean | void, { dispatch, rejectWithValue }) => {
    try {
      return rowsOf(await masterApi.listServices());
    } catch (error: any) {
      dispatch(toast.error("Failed to load services", error?.message));
      return rejectWithValue(error?.message ?? "Failed to load services");
    }
  },
  {
    condition: (force: boolean | void, { getState }) => {
      const s = (getState() as RootState).master.services;
      if (s.status === "loading") return false;
      if (force) return true;
      return s.status === "idle" || s.status === "error";
    },
  },
);

/** Tariff catalogue — read by Tariff Master and the Panel form. */
export const fetchTariffs = createAsyncThunk(
  "master/fetchTariffs",
  async (_force: boolean | void, { dispatch, rejectWithValue }) => {
    try {
      return rowsOf(await masterApi.listTariffs());
    } catch (error: any) {
      dispatch(toast.error("Failed to load tariffs", error?.message));
      return rejectWithValue(error?.message ?? "Failed to load tariffs");
    }
  },
  {
    condition: (force: boolean | void, { getState }) => {
      const s = (getState() as RootState).master.tariffs;
      if (s.status === "loading") return false;
      if (force) return true;
      return s.status === "idle" || s.status === "error";
    },
  },
);

/**
 * One shared reference list, loaded once per session.
 * `force` re-reads it (used after a master value was added/edited elsewhere).
 */
export const fetchMasterDropdown = createAsyncThunk(
  "master/fetchDropdown",
  async (
    arg: { key: MasterDropdownKey; force?: boolean },
    { rejectWithValue },
  ) => {
    try {
      const source = DROPDOWN_SOURCES[arg.key];
      if (!source) throw new Error(`Unknown master dropdown: ${arg.key}`);
      return { key: arg.key, items: rowsOf(await source()) };
    } catch (error: any) {
      return rejectWithValue(
        error?.message ?? "Failed to load dropdown options",
      );
    }
  },
  {
    condition: (arg, { getState }) => {
      const entry = (getState() as RootState).master.dropdowns[arg.key];
      if (entry?.status === "loading") return false;
      if (arg.force) return true;
      return !entry || entry.status === "idle" || entry.status === "error";
    },
  },
);

/* -------------------------------- slice ---------------------------------- */

const masterSlice = createSlice({
  name: "master",
  initialState,
  reducers: {
    /**
     * Mark reference lists stale after a master value was written on another
     * screen (§3.7: a mutation on one page must be visible on the next page).
     * Call with no keys to invalidate every dropdown.
     */
    invalidateMasterDropdowns(
      state,
      action: PayloadAction<MasterDropdownKey[] | undefined>,
    ) {
      const keys = action.payload ?? (Object.keys(DROPDOWN_SOURCES) as MasterDropdownKey[]);
      keys.forEach((key) => {
        const entry = state.dropdowns[key];
        if (entry) entry.status = "idle";
        else state.dropdowns[key] = { ...empty() };
      });
    },
    /** Signing out empties every cached master list (see authListener). */
    clearMasters: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServices.pending, (s) => {
        s.services.status = "loading";
        s.services.error = null;
      })
      .addCase(fetchServices.fulfilled, (s, a) => {
        s.services.items = a.payload;
        s.services.status = "ready";
      })
      .addCase(fetchServices.rejected, (s, a) => {
        s.services.status = "error";
        s.services.error = (a.payload as string) ?? "Failed to load services";
      })

      .addCase(fetchTariffs.pending, (s) => {
        s.tariffs.status = "loading";
        s.tariffs.error = null;
      })
      .addCase(fetchTariffs.fulfilled, (s, a) => {
        s.tariffs.items = a.payload;
        s.tariffs.status = "ready";
      })
      .addCase(fetchTariffs.rejected, (s, a) => {
        s.tariffs.status = "error";
        s.tariffs.error = (a.payload as string) ?? "Failed to load tariffs";
      })

      .addCase(fetchMasterDropdown.pending, (s, a) => {
        const { key } = a.meta.arg;
        s.dropdowns[key] = {
          items: s.dropdowns[key]?.items ?? [],
          status: "loading",
          error: null,
        };
      })
      .addCase(fetchMasterDropdown.fulfilled, (s, a) => {
        s.dropdowns[a.payload.key] = {
          items: a.payload.items,
          status: "ready",
          error: null,
        };
      })
      .addCase(fetchMasterDropdown.rejected, (s, a) => {
        const key = (a.meta.arg as { key: MasterDropdownKey }).key;
        s.dropdowns[key] = {
          items: s.dropdowns[key]?.items ?? [],
          status: "error",
          error: (a.payload as string) ?? "Failed to load dropdown options",
        };
      });
  },
});

export const { invalidateMasterDropdowns, clearMasters } = masterSlice.actions;

/* ------------------------------- selectors -------------------------------- */

export const selectServices = (s: RootState) => s.master.services.items;
export const selectServicesStatus = (s: RootState) => s.master.services.status;
export const selectTariffs = (s: RootState) => s.master.tariffs.items;
export const selectTariffsStatus = (s: RootState) => s.master.tariffs.status;
export const selectMasterDropdown =
  (key: MasterDropdownKey) =>
  (s: RootState): any[] =>
    s.master.dropdowns[key]?.items ?? [];

export default masterSlice.reducer;
