/**
 * Bed picker — the single bed-selection surface used by the admission form,
 * the "assign bed" action and the "transfer bed" action.
 *
 *   <BedPicker value={bedId} onChange={setBedId} patientGender="MALE"
 *              selectableStatuses={["AVAILABLE"]} />
 *
 * Data comes from the ward-room masters that already exist:
 *   GET /api/hospital/masters/room-types
 *   GET /api/hospital/masters/beds?roomTypeId=&gender=&isActive=true
 *
 * The grid mirrors the server rules client-side (gender ward + legal status)
 * so a wrong choice cannot be made — the server re-checks on submit.
 *
 * Location note: ye file shared UI kit (`src/components/ui/`) me rehti hai, par
 * IPD-specific hai — isliye ise `@/pages/ipd/*` ke service/types/constants chahiye.
 * Non-IPD screen me reuse karne se pehle IPD dependency hata lena.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, RefreshCw } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Button, Badge } from "./primitives";
import { Select, SearchInput } from "./fields";
import { InlineLoader } from "./feedback";
import { ipdService } from "@/pages/ipd/ipd.service";
import type { BedRow, RoomTypeRow } from "@/types/ipdTypes";
import { bedStatusOf } from "@/constants/ipd.constants";
import { BedLegend, WardBedGrid } from "./BedGrid";

export interface BedPickerProps {
  value: string;
  onChange: (bedId: string, bed?: BedRow) => void;
  /** patient's gender — rooms of the opposite gender are shown but blocked */
  patientGender?: string | null;
  /** statuses the caller will accept (admission: AVAILABLE/RESERVED) */
  selectableStatuses?: string[];
  /** a bed that must never be offered (the bed the patient already occupies) */
  excludeBedId?: string | null;
  /** panel that renders the grid; the picker stays the same component */
  compact?: boolean;
}

export function BedPicker({
  value,
  onChange,
  patientGender,
  selectableStatuses = ["AVAILABLE", "RESERVED"],
  excludeBedId,
  compact,
}: BedPickerProps) {
  const dispatch = useAppDispatch();

  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [search, setSearch] = useState("");

  /* ------------------------------- room types ------------------------------ */

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await ipdService.fetchRoomTypes();
        if (active && res.status === 200) setRoomTypes(res.data ?? []);
      } catch (e: any) {
        // a missing room-type master must not break bed selection
        dispatch(toast.error("Could not load room types", e?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, [dispatch]);

  /* ---------------------------------- beds --------------------------------- */

  const loadBeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipdService.fetchBeds({
        roomTypeId: typeFilter === "all" ? undefined : typeFilter,
        gender: genderFilter === "all" ? undefined : genderFilter,
        isActive: true,
      });
      if (res.status === 200) setBeds(res.data ?? []);
    } catch (e: any) {
      dispatch(toast.error("Could not load beds", e?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch, typeFilter, genderFilter]);

  useEffect(() => {
    void loadBeds();
  }, [loadBeds]);

  /* -------------------------------- filtering ------------------------------ */

  const visibleBeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allowed = selectableStatuses;
    return beds
      .filter((bed) => bed.id !== excludeBedId)
      .filter((bed) => {
        if (!q) return true;
        return (
          bed.bedIdentifier.toLowerCase().includes(q) ||
          bed.room.roomNumber.toLowerCase().includes(q) ||
          (bed.room.roomType?.name ?? "").toLowerCase().includes(q)
        );
      })
      // blocked beds stay visible (dimmed with a reason) so a ward can never
      // feel "missing" — the sort pushes selectable beds to the top
      .sort((a, b) => {
        const rank = (bed: BedRow) => {
          const status = bed.statusHistory?.[0]?.status ?? "AVAILABLE";
          const blocked = !allowed.includes(status);
          return blocked ? 1 : 0;
        };
        return rank(a) - rank(b);
      });
  }, [beds, search, selectableStatuses, excludeBedId]);

  const selectedBed = useMemo(
    () => beds.find((bed) => bed.id === value) ?? null,
    [beds, value],
  );

  const selectableCount = useMemo(
    () =>
      visibleBeds.filter((bed) => {
        const status = bed.statusHistory?.[0]?.status ?? "AVAILABLE";
        if (!selectableStatuses.includes(status)) return false;
        const room = bed.room.gender;
        const patient = (patientGender ?? "").toUpperCase();
        if (!patient) return true;
        if (room === "MALE_ONLY" && patient !== "MALE") return false;
        if (room === "FEMALE_ONLY" && patient !== "FEMALE") return false;
        return true;
      }).length,
    [visibleBeds, selectableStatuses, patientGender],
  );

  return (
    <div className="space-y-3">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          className="w-[13rem]"
          name="bedRoomType"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "All room types" },
            ...roomTypes.map((type) => ({
              value: type.id,
              label: `${type.name} · ₹${Number(type.defaultRate ?? 0).toLocaleString("en-IN")}/day`,
            })),
          ]}
        />
        <Select
          size="sm"
          className="w-[11rem]"
          name="bedWardGender"
          value={genderFilter}
          onChange={setGenderFilter}
          options={[
            { value: "all", label: "Any ward" },
            { value: "MALE_ONLY", label: "Male only" },
            { value: "FEMALE_ONLY", label: "Female only" },
            { value: "PEDIATRIC", label: "Paediatric" },
            { value: "ANY", label: "Any gender" },
          ]}
        />
        <div className="min-w-[13rem] flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search bed, room or ward…"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<RefreshCw />}
          onClick={() => void loadBeds()}
        >
          Refresh
        </Button>
      </div>

      {/* selection status line */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={selectedBed ? "brand" : "neutral"} dot={!!selectedBed}>
          {selectedBed ? (
            <>
              {selectedBed.bedIdentifier} ·{" "}
              {bedStatusOf(selectedBed.statusHistory?.[0]?.status).label}
            </>
          ) : (
            "No bed selected"
          )}
        </Badge>
        <span className="text-[11.5px] text-ink-400">
          {loading ? "Loading beds…" : `${selectableCount} bed(s) selectable`}
          {patientGender ? ` · patient: ${patientGender}` : ""}
        </span>
        {selectedBed && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11.5px] font-medium text-coral-600 hover:text-coral-700"
          >
            Clear selection
          </button>
        )}
      </div>

      {loading && !beds.length ? (
        <InlineLoader label="Loading beds…" />
      ) : (
        <WardBedGrid
          beds={visibleBeds}
          selectedBedId={value || null}
          selectableStatuses={selectableStatuses}
          patientGender={patientGender}
          onSelectBed={(bed) => onChange(bed.id, bed)}
          emptyLabel="No beds match this filter. Configure rooms & beds under ward setup first."
        />
      )}

      {!compact && <BedLegend />}

      {patientGender && (
        <p className="text-[11.5px] leading-relaxed text-ink-400">
          Beds in wards that do not accept a {patientGender.toLowerCase()}{" "}
          patient are shown dimmed — the server enforces the same rule on
          assign/transfer.
        </p>
      )}
    </div>
  );
}

/** A non-interactive summary card of a bed (used in the chart header). */
export function BedSummaryCard({
  bedIdentifier,
  roomType,
  ward,
}: {
  bedIdentifier?: string | null;
  roomType?: string | null;
  ward?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3">
      <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <BedDouble className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="num truncate text-[14px] font-semibold text-ink-900">
          {bedIdentifier ?? "Bed not assigned"}
        </p>
        <p className="truncate text-[11.5px] text-ink-400">
          {[roomType, ward].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
    </div>
  );
}
