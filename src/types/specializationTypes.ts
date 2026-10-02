/**
 * Specialization model — clinical speciality linked to a department.
 */

import type { ID, ISODateTime, Status } from "./commonTypes";

export interface Specialization {
  id: ID;
  name: string;
  code: string;
  departmentId: ID;
  description: string;
  status: Status;
  createdAt: ISODateTime;
}
