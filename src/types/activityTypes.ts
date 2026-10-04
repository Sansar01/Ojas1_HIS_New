/**
 * Activity / audit-log model.
 */

import type { ID, ISODateTime } from "./commonTypes";

export interface ActivityLog {
  id: ID;
  userName: string;
  action: string;
  entity: string;
  entityName: string;
  at: ISODateTime;
  tone: "brand" | "amber" | "coral" | "mint" | "lagoon";
}
