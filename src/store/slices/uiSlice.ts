import {
  createAction,
  createSlice,
  nanoid,
  type PayloadAction,
} from "@reduxjs/toolkit";

/* ---------------------------------------------------------------------------
 * Global UI state — toast queue, full page loader, sidebar & mobile nav.
 * ------------------------------------------------------------------------ */

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface UiState {
  loader: { count: number; label: string | null };
  toasts: Toast[];
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  confirm: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: "danger" | "brand" | "warn";
    resolve?: ((value: boolean) => void) | null;
  };
}

const initialState: UiState = {
  loader: { count: 0, label: null },
  toasts: [],
  sidebarCollapsed: false,
  mobileNavOpen: false,
  confirm: {
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    tone: "danger",
    resolve: null,
  },
};

export const pushToast = createAction<{
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  id?: string;
}>("ui/toast/push");

export const showLoader = createAction<string | undefined>("ui/loader/show");
export const hideLoader = createAction("ui/loader/hide");

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(s) {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    },
    setSidebar(s, action: PayloadAction<boolean>) {
      s.sidebarCollapsed = action.payload;
    },
    setMobileNav(s, action: PayloadAction<boolean>) {
      s.mobileNavOpen = action.payload;
    },
    dismissToast(s, action: PayloadAction<string>) {
      s.toasts = s.toasts.filter((t) => t.id !== action.payload);
    },
    askConfirm(
      s,
      action: PayloadAction<{
        title: string;
        description: string;
        confirmLabel?: string;
        tone?: "danger" | "brand" | "warn";
      }>,
    ) {
      s.confirm = {
        open: true,
        title: action.payload.title,
        description: action.payload.description,
        confirmLabel: action.payload.confirmLabel ?? "Confirm",
        tone: action.payload.tone ?? "danger",
        resolve: s.confirm.resolve ?? null,
      };
    },
    closeConfirm(s) {
      s.confirm.open = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(pushToast, (s, action) => {
        s.toasts.push({
          id: action.payload.id ?? nanoid(),
          title: action.payload.title,
          description: action.payload.description,
          variant: action.payload.variant ?? "info",
          duration: action.payload.duration ?? 4200,
        });
        if (s.toasts.length > 4) s.toasts.shift();
      })
      .addCase(showLoader, (s, action) => {
        s.loader.count += 1;
        s.loader.label = action.payload ?? s.loader.label;
      })
      .addCase(hideLoader, (s) => {
        s.loader.count = Math.max(0, s.loader.count - 1);
        if (s.loader.count === 0) s.loader.label = null;
      });
  },
});

export const {
  toggleSidebar,
  setSidebar,
  setMobileNav,
  dismissToast,
  askConfirm,
  closeConfirm,
} = uiSlice.actions;

/** Imperative helpers usable from anywhere (dispatch-based, no context needed). */
export const toast = {
  success: (title: string, description?: string) =>
    pushToast({ title, description, variant: "success" }),
  error: (title: string, description?: string) =>
    pushToast({ title, description, variant: "error", duration: 3000 }),
  warning: (title: string, description?: string) =>
    pushToast({ title, description, variant: "warning", duration: 3000 }),
  info: (title: string, description?: string) =>
    pushToast({ title, description, variant: "info" }),
  /** generic entry point — also used by the shared useToast() hook */
  push: (payload: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => pushToast(payload),
};

export const FORM_INVALID = () =>
  pushToast({
    title: "Please fill all the required fields",
    description: "Highlighted fields need your attention before submitting.",
    variant: "warning",
    duration: 4600,
  });

export default uiSlice.reducer;
