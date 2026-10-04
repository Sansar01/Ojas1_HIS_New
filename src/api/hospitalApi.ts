/**
 * Hospital domain API — facility profile used by invoice/report headers.
 *
 *   GET /hospital      hospitalApi.getProfile
 *
 * Reserved for the hospital domain: exactly one owner for the endpoint
 * (Rule 2). The slice (`hospitalSlice`) holds the result because several
 * screens render the facility name.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { HospitalInfo } from "@/types";

export const hospitalApi = {
  getProfile: () =>
    apiClient<HospitalInfo>(API_ENDPOINTS.hospitals.profile, {
      method: "GET",
    }),

  saveProfile: (payload: HospitalInfo) =>
    apiClient<HospitalInfo>(API_ENDPOINTS.hospitals.profile, {
      method: "PUT",
      body: payload,
    }),
};

