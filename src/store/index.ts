/**
 * Store barrel — `@/store` exposes the store instance, its types and the
 * generic Redux hooks.
 */

export { store, bootstrapResources } from "./store";
export type { RootState, AppDispatch, AppThunk } from "./types";
export {
  useAppDispatch,
  useAppSelector,
  useRootSelector,
} from "./hooks";
