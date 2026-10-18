import type { Schema } from "@/schemas/rules";

/* Ward-setup dialogs (room types, rooms, beds, bulk beds, amenities). */

export const roomTypeSchema = {
  name: [{ required: "Required" }],
  code: [{ required: "Required" }],
} satisfies Schema;
export const ROOM_TYPE_LABELS = { name: "Name", code: "Code" } as const;

export const roomSchema = {
  roomTypeId: [{ required: "Required" }],
  roomNumber: [{ required: "Required" }],
} satisfies Schema;
export const ROOM_LABELS = {
  roomTypeId: "Room type",
  roomNumber: "Room number",
} as const;

export const bedSchema = {
  roomId: [{ required: "Required" }],
  bedNumber: [{ required: "Required" }],
} satisfies Schema;
export const BED_LABELS = { roomId: "Room", bedNumber: "Bed number" } as const;

export const bulkBedsSchema = {
  roomId: [{ required: "Required" }],
} satisfies Schema;
export const BULK_BEDS_LABELS = { roomId: "Room" } as const;

export const amenitySchema = {
  name: [{ required: "Required" }],
  code: [{ required: "Required" }],
} satisfies Schema;
export const AMENITY_LABELS = { name: "Name", code: "Code" } as const;
