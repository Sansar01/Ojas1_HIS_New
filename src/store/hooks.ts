/**
 * Generic Redux hooks — the ONLY place `useDispatch`/`useSelector` are
 * wrapped with app types.
 *
 *   import { useAppDispatch, useAppSelector } from "@/store/hooks";
 *
 * Do NOT create feature hooks just for selectors (no `usePatients`,
 * `useAppointments`, …) — compose these generic hooks with plain selectors
 * in the components instead.
 */

import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./types";

/** Typed `dispatch` for thunks and actions. */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/** Typed `selector` over the whole store state. */
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector<RootState, T>(selector);

/** @deprecated alias of `useAppSelector`, kept for older call sites. */
export const useRootSelector = useAppSelector;
