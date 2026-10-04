/**
 * Store barrel — `@/store` exposes the store instance, its types and the
 * generic Redux hooks.
 *
 * Feature data is no longer part of the store: pages import the feature
 * service from their own folder (`@/pages/patients/patient.service`, …) and
 * keep the result in local state.
 */

export { store } from "./store";
export type { RootState, AppDispatch, AppThunk } from "./types";
export {
  useAppDispatch,
  useAppSelector,
  useRootSelector,
} from "./hooks";
