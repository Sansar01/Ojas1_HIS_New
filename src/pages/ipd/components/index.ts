/**
 * IPD feature components — everything the IPD screens share among themselves.
 *
 *   bed board        BedGrid        WardBedGrid · BedTile · BedLegend · groupBedsByRoom
 *   bed selection    BedPicker      BedPicker · BedSummaryCard
 *   bed lifecycle    IpdActionDialogs  AssignBedDialog · TransferBedDialog · CancelAdmissionDialog
 *   ward setup       WardSetupDialogs  RoomTypeDialog · RoomDialog · BedDialog ·
 *                                      BulkBedsDialog · RoomAmenitiesDialog · AmenityDialog
 *   IPD presentation IpdBits        AdmissionStatusBadge · BedStatusBadge · Chip ·
 *                                   InfoRow · PendingBackendNote
 *
 *   import {
 *     AssignBedDialog, BedLegend, BedPicker, PendingBackendNote, WardBedGrid,
 *   } from "@/pages/ipd/components";
 *
 * These are IPD-only: they read the IPD service, IPD types and the bed/ward
 * status metadata. Anything an OPD screen could use stays in the shared kit
 * under `@/components/ui`.
 */

export * from "./BedGrid";
export * from "./BedPicker";
export * from "./IpdActionDialogs";
export * from "./IpdBits";
export * from "./WardSetupDialogs";
