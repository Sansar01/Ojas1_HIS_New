/**
 * Ward bed grid — the visual bed board of the IPD flow.
 *
 *   <WardBedGrid beds={beds} admissionsByBed={map} onSelectBed={…} />
 *
 * Renders the real `GET /api/hospital/masters/beds` rows grouped by room, one
 * tile per bed coloured by its CURRENT status (the 7 states of the bed state
 * machine). Nothing is inferred: if a bed has no status row the server treats
 * it as AVAILABLE and so does this grid.
 *
 * Lives in the IPD feature folder (`src/pages/ipd/components/`) because every
 * export is IPD-specific: bed statuses, ward gender rules and the admission
 * slice. It is shared by the ward board (`/ipd`) and by `BedPicker`, and it
 * reuses the app-wide UI kit (`@/components/ui/*`) rather than its own.
 */

import { useMemo } from "react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/feedback";
import {
  BED_LEGEND_ORDER,
  bedStatusOf,
  wardGenderConflict,
  wardGenderLabel,
} from "@/constants/ipd.constants";
import type { BedRow, IpdAdmission } from "@/types/ipdTypes";
import { patientName } from "@/types/ipdTypes";

/* --------------------------------- helpers --------------------------------- */

interface RoomGroup {
  roomId: string;
  roomNumber: string;
  roomType: string;
  gender: string;
  floor: string | null;
  wing: string | null;
  beds: BedRow[];
}

const statusOfBed = (bed: BedRow) =>
  bed.statusHistory?.[0]?.status ?? "AVAILABLE";

export const groupBedsByRoom = (beds: BedRow[]): RoomGroup[] => {
  const map = new Map<string, RoomGroup>();
  for (const bed of beds) {
    const room = bed.room;
    const group =
      map.get(room.id) ??
      ({
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType?.name ?? "—",
        gender: room.gender,
        floor: room.floor,
        wing: room.wing,
        beds: [],
      } as RoomGroup);
    group.beds.push(bed);
    map.set(room.id, group);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
  );
};

/* ---------------------------------- tile ----------------------------------- */

export function BedTile({
  bed,
  patientLabel,
  selected,
  disabledReason,
  onClick,
  compact,
}: {
  bed: BedRow;
  /** occupied beds show the current patient; resolved by the caller */
  patientLabel?: string | null;
  selected?: boolean;
  /** when set the tile is not clickable and shows the reason */
  disabledReason?: string | null;
  onClick?: () => void;
  compact?: boolean;
}) {
  const status = statusOfBed(bed);
  const meta = bedStatusOf(status);
  const clickable = Boolean(onClick) && !disabledReason;

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={
        disabledReason
          ? `${bed.bedIdentifier} — ${disabledReason}`
          : `${bed.bedIdentifier} — ${meta.label}`
      }
      className={cn(
        "group relative flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150",
        meta.tile,
        clickable && "cursor-pointer hover:-translate-y-0.5 hover:shadow-pop",
        !clickable && "cursor-not-allowed opacity-70",
        selected && "ring-2 ring-brand-500 ring-offset-1",
        compact ? "min-h-[68px]" : "min-h-[84px]",
      )}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span className="num truncate text-[12px] font-bold text-ink-900">
          {bed.bedNumber ? `Bed ${bed.bedNumber}` : bed.bedIdentifier}
        </span>
        <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
      </span>

      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.1em]",
          "opacity-80",
        )}
      >
        {meta.short}
      </span>

      {patientLabel ? (
        <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink-600">
          {patientLabel}
        </span>
      ) : (
        <span className="text-[11px] leading-tight text-ink-400">
          {disabledReason ?? "Select"}
        </span>
      )}
    </button>
  );
}

/* --------------------------------- grid ------------------------------------ */

export interface WardBedGridProps {
  beds: BedRow[];
  /** bedId → admission, used to label occupied / discharge-pending beds */
  admissionsByBed?: Map<string, IpdAdmission>;
  /** the bed currently selected in a picker (highlighted) */
  selectedBedId?: string | null;
  /** when given, only these statuses are clickable (others show why) */
  selectableStatuses?: string[];
  /** patient gender — used to explain gender-ward blocks in a picker */
  patientGender?: string | null;
  onSelectBed?: (bed: BedRow) => void;
  /** first paint of the board — renders the shared skeleton tiles */
  loading?: boolean;
  emptyLabel?: string;
}

export function WardBedGrid({
  beds,
  admissionsByBed,
  selectedBedId,
  selectableStatuses,
  patientGender,
  onSelectBed,
  loading,
  emptyLabel = "No beds configured for this selection.",
}: WardBedGridProps) {
  const rooms = useMemo(() => groupBedsByRoom(beds), [beds]);

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading beds">
        {Array.from({ length: 2 }).map((_, room) => (
          <div key={room}>
            <div className="mb-2 flex items-center gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((__, bed) => (
                <Skeleton key={bed} className="h-[84px] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!rooms.length) {
    return (
      <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-[12.5px] text-ink-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {rooms.map((room) => {
        // one gender rule, shared with the picker and mirrored by the server
        const genderMismatch = wardGenderConflict(room.gender, patientGender);

        return (
          <div key={room.roomId}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="num text-[13px] font-semibold text-ink-900">
                {room.roomNumber}
              </span>
              <span className="text-[11.5px] text-ink-400">
                {room.roomType}
                {room.floor ? ` · Floor ${room.floor}` : ""}
                {room.wing ? ` · ${room.wing}` : ""}
              </span>
              <Badge tone="neutral" size="xs">
                {wardGenderLabel(room.gender)}
              </Badge>
              {genderMismatch && (
                <Badge tone="coral" size="xs">
                  {genderMismatch}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {room.beds.map((bed) => {
                const status = statusOfBed(bed);
                const admission = admissionsByBed?.get(bed.id);
                const patientLabel =
                  status === "OCCUPIED" || status === "DISCHARGE_PENDING"
                    ? admission
                      ? patientName(admission)
                      : "Occupied"
                    : null;

                const disabledReason = genderMismatch
                  ? genderMismatch
                  : selectableStatuses && !selectableStatuses.includes(status)
                    ? bedStatusOf(status).label
                    : null;

                return (
                  <BedTile
                    key={bed.id}
                    bed={bed}
                    patientLabel={patientLabel}
                    selected={selectedBedId === bed.id}
                    disabledReason={disabledReason}
                    onClick={onSelectBed ? () => onSelectBed(bed) : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The colour legend shown under the board — driven by the status metadata. */
export function BedLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {BED_LEGEND_ORDER.map((status) => {
        const meta = bedStatusOf(status);
        return (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-500"
          >
            <span className={cn("size-2 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
