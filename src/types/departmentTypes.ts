/**
 * Department model — organisational unit of the hospital.
 */

import type { ID, ISODateTime, Status } from "./commonTypes";

export interface Department {
  id: ID;
  name: string;
  code: string;
  description: string;
  headDoctorId: ID | null;
  floor: string;
  status: Status;
  isActive?: boolean;
  createdAt: ISODateTime;
}
