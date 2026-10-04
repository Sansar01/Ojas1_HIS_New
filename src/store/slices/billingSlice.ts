/**
 * Billing slice — billing / invoice state.
 *
 *   billingSlice
 *       ├── items / status / error   (invoices-specific list state)
 *       ├── fetchInvoices() / fetchInvoice()
 *       ├── createInvoice() / updateInvoice() / deleteInvoice()
 *       └── toggleInvoiceStatus()
 *
 * Uses the centralised invoices endpoints:
 *   API_ENDPOINTS.billing.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { billingApi } from "@/api/billingApi";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, Invoice, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): Invoice => raw as Invoice;

/* ------------------------------- thunks ---------------------------------- */

export const fetchInvoices = createAsyncThunk(
  "invoices/fetchAll",
  async (_force: boolean | void, { dispatch }) => {
    dispatch(showLoader("Loading"));
    try {
      const res = await billingApi.list();
      dispatch(hideLoader());

      const responseData = Array.isArray(res) ? res : (res as any).data;
      const rows = Array.isArray(responseData)
        ? responseData
        : (responseData?.rows ?? []);
      return rows.map(map);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load invoices", error?.message));
      throw error;
    }
  },
  {
        condition: (force: boolean | void, { getState }) => {
      const state = getState() as RootState;
      if (state.invoices.status === "loading") return false;   // in flight
      if (force) return true;                                 // manual refresh
      // shared list: idle -> fetch, ready -> reuse (§13)
      return state.invoices.status === "idle" || state.invoices.status === "error";
    },
  },
);

export const fetchInvoice = createAsyncThunk(
  "invoices/getOne",
  async (id: string, { dispatch }) => {
    dispatch(showLoader("Loading invoices record"));
    try {
      const res = await billingApi.getById(id);
      dispatch(hideLoader());
      const responseData: any = (res as any)?.data ?? res;
      return map(responseData?.data ?? responseData?.item ?? responseData);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load invoices record", error?.message));
      throw error;
    }
  },
);

export const createInvoice = createAsyncThunk(
  "invoices/create",
  async (payload: WritePayload<Invoice>, { dispatch }) => {
    dispatch(showLoader("Creating record"));
    try {
      const res = await billingApi.create(payload.data);
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

export const updateInvoice = createAsyncThunk(
  "invoices/update",
  async (
    payload: WritePayload<Invoice> & { id: string },
    { dispatch },
  ) => {
    dispatch(showLoader("Saving changes"));
    try {
      const res = await billingApi.update(payload.id, payload.data);
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

export const deleteInvoice = createAsyncThunk(
  "invoices/remove",
  async (
    payload: { id: string; label?: string },
    { dispatch },
  ) => {
    dispatch(showLoader("Deleting record"));
    try {
      await billingApi.remove(payload.id);
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

export const toggleInvoiceStatus = createAsyncThunk(
  "invoices/toggleActive",
  async (
    payload: { id: string; status: Status; label?: string },
    { dispatch },
  ) => {
    try {
      const res = await billingApi.update(payload.id, { status: payload.status });
      dispatch(
        toast.info(
          payload.status === "active" ? "Marked active" : "Marked inactive",
          payload.label
            ? `${payload.label} is now ${payload.status}.`
            : undefined,
        ),
      );
      return res.data as Invoice;
    } catch (error: any) {
      dispatch(toast.error("Status change failed", error?.message));
      throw error;
    }
  },
);

/* -------------------------------- slice ---------------------------------- */

const billingSlice = createSlice({
  name: "invoices",
  initialState: {
    items: [],
    status: "idle",
    saving: false,
    error: null,
    lastSync: null,
  } as CrudState<Invoice>,
  reducers: {
    patchInvoice(s, action: PayloadAction<Partial<Invoice> & { id: string }>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
    },
    upsertInvoice(s, action: PayloadAction<Invoice>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = action.payload;
      else s.items.unshift(action.payload);
    },
    removeInvoiceLocal(s, action: PayloadAction<string>) {
      s.items = s.items.filter((i) => i.id !== action.payload);
    },
    clearInvoices(s) {
      s.items = [];
      s.status = "idle";
    },
    /**
     * Mark the shared invoice snapshot stale after a billing write (doc §3.7/§17).
     * The Billing screen keeps its own filtered list, so it cannot patch this
     * snapshot directly; the next reader (Dashboard, patient detail, header
     * search) refetches it exactly once instead of every screen refetching
     * blindly after every payment.
     */
    invalidateInvoices(s) {
      s.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (s, action) => {
        s.status = "ready";
        s.items = action.payload as Invoice[];
        s.lastSync = new Date().toISOString();
      })
      .addCase(fetchInvoices.rejected, (s, action) => {
        s.status = "error";
        s.error = (action.error.message as string) ?? "Request failed";
      })
      .addCase(fetchInvoice.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Invoice);
      })
      .addCase(createInvoice.fulfilled, (s, action) => {
        s.items.unshift(action.payload as Invoice);
      })
      .addCase(updateInvoice.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Invoice);
      })
      .addCase(deleteInvoice.fulfilled, (s, action) => {
        s.items = s.items.filter((i) => i.id !== action.payload);
      })
      .addCase(toggleInvoiceStatus.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
      });
  },
});

export const {
  patchInvoice,
  upsertInvoice,
  removeInvoiceLocal,
  clearInvoices,
  invalidateInvoices,
} = billingSlice.actions;

export default billingSlice.reducer;
