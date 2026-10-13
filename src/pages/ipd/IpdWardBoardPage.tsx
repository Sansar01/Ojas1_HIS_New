/**
 * IPD Ward Board — `/ipd` (the landing screen of the IPD module).
 *
 * The single "where is everyone" screen of the ward:
 *   • every bed of every room as a coloured tile (7-state bed machine)
 *   • BOR KPIs + per-room-type occupancy (GET ward-room/bor-dashboard)
 *   • housekeeping worklist (GET ward-room/housekeeping-queue)
 *   • admissions still waiting for a bed → assign inline
 *
 * All data comes from endpoints that already exist. Clicking a bed:
 *   AVAILABLE / RESERVED     → new admission pre-filled with that bed
 *   OCCUPIED / D/C PENDING   → the patient's IPD chart
 *   HOUSEKEEPING             → "mark cleaned" (AVAILABLE, legal transition)
 *   MAINTENANCE              → "mark available"
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  ClipboardList,
  RefreshCw,
  SprayCan,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { usePermission } from "@/hooks";
import { hideLoader, showLoader, toast } from "@/store/slices/uiSlice";
import { Button, Badge, Kpi, Panel, Progress } from "@/components/ui/primitives";
import { Select, SearchInput } from "@/components/ui/fields";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Skeleton,
} from "@/components/ui/feedback";
import { PageIntro, SectionPanel } from "@/components/common";
import { useConfirmDialog } from "@/components/ui/overlays";
import { ipdService } from "./ipd.service";
import {
  AssignBedDialog,
  BedLegend,
  PendingBackendNote,
  WardBedGrid,
} from "./components";
import { bedStatusOf } from "@/constants/ipd.constants";
import {
  type BedRow,
  type BorDashboard,
  type HousekeepingQueue,
  type IpdAdmission,
  type RoomTypeRow,
  patientName,
} from "@/types/ipdTypes";

export function IpdWardBoardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { canCreate } = usePermission();
  const { ask, confirmNode } = useConfirmDialog();

  const [beds, setBeds] = useState<BedRow[]>([]);
  const [admissions, setAdmissions] = useState<IpdAdmission[]>([]);
  const [bor, setBor] = useState<BorDashboard | null>(null);
  const [housekeeping, setHousekeeping] = useState<HousekeepingQueue | null>(
    null,
  );
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** false until the board has answered once — marks the blocking first paint */
  const [initialised, setInitialised] = useState(false);

  const [typeFilter, setTypeFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [assignTarget, setAssignTarget] = useState<IpdAdmission | null>(null);

  /* ------------------------------- loading -------------------------------- */

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bedsRes, activeRes, borRes, hkRes] = await Promise.all([
        ipdService.fetchBeds({ isActive: true }),
        ipdService.fetchActiveAdmissions(),
        ipdService.fetchBorDashboard(),
        ipdService.fetchHousekeepingQueue(),
      ]);
      if (bedsRes.status === 200) setBeds(bedsRes.data ?? []);
      if (activeRes.status === 200) setAdmissions(activeRes.data ?? []);
      if (borRes.status === 200) setBor(borRes.data ?? null);
      if (hkRes.status === 200) setHousekeeping(hkRes.data ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Could not load the ward board");
      dispatch(toast.error("Could not load the ward board", e?.message));
    } finally {
      setLoading(false);
      setInitialised(true);
    }
  }, [dispatch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /**
   * The board is the whole screen: with no bed data there is nothing to read.
   * The first paint is therefore the page's blocking initialization and runs
   * under the app-wide loader (same rule as the record forms). Later loads —
   * Refresh included — keep the app-wide loader down but swap every section
   * for its skeleton, so the reload is always visible.
   */
  const initialLoading = loading && !initialised;
  useEffect(() => {
    if (!initialLoading) return;
    dispatch(showLoader("Loading ward board"));
    return () => {
      dispatch(hideLoader());
    };
  }, [initialLoading, dispatch]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await ipdService.fetchRoomTypes();
        if (active && res.status === 200) setRoomTypes(res.data ?? []);
      } catch {
        /* filter list is optional — the board still works without it */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ------------------------------- derived -------------------------------- */

  const admissionsByBed = useMemo(() => {
    const map = new Map<string, IpdAdmission>();
    admissions.forEach((a) => {
      if (a.bedId) map.set(a.bedId, a);
    });
    return map;
  }, [admissions]);

  /** Admissions the doctor advised but no bed was given yet. */
  const pendingAdmissions = useMemo(
    () =>
      admissions.filter(
        (a) => a.status === "ADMITTED" && !a.bedId,
      ),
    [admissions],
  );

  const visibleBeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beds
      .filter((bed) =>
        typeFilter === "all" ? true : bed.room.roomType?.id === typeFilter,
      )
      .filter((bed) =>
        genderFilter === "all"
          ? true
          : (bed.room.gender ?? "").toUpperCase() === genderFilter,
      )
      .filter((bed) => {
        if (!q) return true;
        return (
          bed.bedIdentifier.toLowerCase().includes(q) ||
          bed.room.roomNumber.toLowerCase().includes(q) ||
          (bed.room.roomType?.name ?? "").toLowerCase().includes(q)
        );
      });
  }, [beds, typeFilter, genderFilter, search]);

  /* ------------------------------- actions -------------------------------- */

  const markBedAvailable = useCallback(
    async (bed: { id: string; bedIdentifier: string }, reason: string) => {
      // bed status is a write to the ward state machine → global loader
      dispatch(showLoader("Releasing bed"));
      try {
        await ipdService.changeBedStatus(bed.id, {
          status: "AVAILABLE",
          reason,
        });
        dispatch(
          toast.success(
            "Bed available",
            `${bed.bedIdentifier} is ready for the next patient.`,
          ),
        );
        void loadAll();
      } catch (e: any) {
        dispatch(toast.error("Could not update bed", e?.message));
      } finally {
        dispatch(hideLoader());
      }
    },
    [dispatch, loadAll],
  );

  const handleBedClick = useCallback(
    (bed: BedRow) => {
      const status = bed.statusHistory?.[0]?.status ?? "AVAILABLE";
      const admission = admissionsByBed.get(bed.id);

      if (status === "OCCUPIED" || status === "DISCHARGE_PENDING") {
        if (admission) {
          navigate(`/ipd/admissions/${admission.id}`);
        } else {
          dispatch(
            toast.info(
              "Admission link missing",
              `${bed.bedIdentifier} shows ${bedStatusOf(status).label} but no active admission points at it.`,
            ),
          );
        }
        return;
      }

      if (status === "HOUSEKEEPING") {
        ask({
          title: `Mark ${bed.bedIdentifier} available?`,
          description:
            "Cleaning is complete and the bed can take the next patient. The bed moves HOUSEKEEPING → AVAILABLE.",
          confirmLabel: "Mark available",
          tone: "brand",
          action: () => markBedAvailable(bed, "Housekeeping complete"),
        });
        return;
      }

      if (status === "MAINTENANCE") {
        ask({
          title: `Mark ${bed.bedIdentifier} available?`,
          description:
            "Maintenance is finished. The bed moves MAINTENANCE → AVAILABLE.",
          confirmLabel: "Mark available",
          tone: "brand",
          action: () => markBedAvailable(bed, "Maintenance complete"),
        });
        return;
      }

      // AVAILABLE / RESERVED → start an admission on this bed
      navigate(`/ipd/admissions/new?bedId=${bed.id}`);
    },
    [admissionsByBed, ask, dispatch, markBedAvailable, navigate],
  );

  const totalBeds = bor?.countableBeds ?? beds.length;
  const occupied = bor?.occupiedBeds ?? 0;
  const available = bor?.availableBeds ?? 0;
  const housekeepingCount = housekeeping?.total ?? 0;
  const borPercent = bor?.borPercent ?? 0;

  return (
    <>
      <PageIntro
        title="IPD ward board"
        description="Live bed map of the hospital — assign a bed, move a patient, release a cleaned bed, or jump into any admitted patient's chart."
        module="ipd"
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              icon={<ClipboardList />}
              onClick={() => navigate("/ipd/admissions")}
            >
              Admission census
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => void loadAll()}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<BedDouble />}
              onClick={() => navigate("/ipd/setup")}
            >
              Ward setup
            </Button>
          </>
        }
        onCreate={() => navigate("/ipd/admissions/new")}
        createLabel="New admission"
        meta={
          loading ? (
            <>
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </>
          ) : (
          <>
            <Badge tone="brand" dot>
              {occupied} occupied
            </Badge>
            <Badge tone="mint" dot>
              {available} available
            </Badge>
            <Badge tone="amber">{housekeepingCount} cleaning</Badge>
            <Badge tone="neutral">{totalBeds} countable beds</Badge>
            {pendingAdmissions.length > 0 && (
              <Badge tone="coral">
                {pendingAdmissions.length} awaiting bed
              </Badge>
            )}
          </>
          )
        }
      />

      {/* ------------------------------- KPIs ------------------------------- */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Bed occupancy rate"
          value={`${borPercent}%`}
          hint={`${occupied} of ${totalBeds} countable beds`}
          tone="brand"
          icon={<TrendingUp />}
          card
        />
        <Kpi
          label="Occupied"
          value={occupied}
          hint="Patient currently in a bed"
          tone="coral"
          icon={<BedDouble />}
          card
        />
        <Kpi
          label="Available"
          value={available}
          hint="Ready to admit now"
          tone="mint"
          icon={<BedDouble />}
          card
        />
        <Kpi
          label="Awaiting bed"
          value={pendingAdmissions.length}
          hint="Admitted, bed not assigned"
          tone="amber"
          icon={<Users />}
          card
        />
      </div>
      )}

      <div className="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        {/* ------------------------------ bed map ------------------------------ */}
        <Panel className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[15px] font-semibold text-ink-900">
              Bed map
            </h3>
            <span className="text-[12px] text-ink-400">
              Click a bed to admit, open the chart, or release it
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select
              size="sm"
              className="w-[13rem]"
              name="boardRoomType"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All room types" },
                ...roomTypes.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <Select
              size="sm"
              className="w-[11rem]"
              name="boardWardGender"
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
            <div className="min-w-[12rem] flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search bed, room, ward…"
              />
            </div>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => void loadAll()} compact />
          ) : (
            <>
              {beds.length === 0 && !loading && (
                <div className="mb-3">
                  <PendingBackendNote
                    title="No rooms or beds exist for this hospital yet"
                    endpoints={[
                      "POST /api/hospital/masters/room-types",
                      "POST /api/hospital/masters/rooms",
                      "POST /api/hospital/masters/beds + /beds/bulk",
                    ]}
                  >
                    Create them under "Ward setup" above — the screen is ready
                    and starts writing the moment the backend branch hims-v2 is
                    deployed (these routes answer 404 until then). Until then
                    the board shows the beds the backend seed created.
                  </PendingBackendNote>
                </div>
              )}
              <WardBedGrid
                beds={visibleBeds}
                admissionsByBed={admissionsByBed}
                loading={loading}
                onSelectBed={handleBedClick}
              />
              <div className="mt-4 border-t border-ink-100 pt-3">
                <BedLegend />
              </div>
            </>
          )}
        </Panel>

        {/* ----------------------------- side panels --------------------------- */}
        <div className="space-y-4">
          <SectionPanel
            title="Housekeeping queue"
            subtitle="Beds waiting to be cleaned (auto-worklist)"
            icon={<SprayCan className="size-4.5" />}
          >
            {loading || !housekeeping ? (
              <ListSkeleton rows={2} className="-mx-4 -my-4" />
            ) : housekeeping.items.length === 0 ? (
              <EmptyState
                title="Nothing to clean"
                description="Every discharge has been turned around."
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {housekeeping.items.map((item) => (
                  <li
                    key={item.bedId}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="num truncate text-[13px] font-semibold text-ink-800">
                        {item.bedIdentifier}
                      </p>
                      <p className="truncate text-[11.5px] text-ink-400">
                        {item.roomType?.name} · {item.roomNumber}
                        {item.floor ? ` · Floor ${item.floor}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        Pending since{" "}
                        {new Date(item.pendingSince).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        ask({
                          title: `Mark ${item.bedIdentifier} available?`,
                          description:
                            "Cleaning is complete — the bed goes back into the pool (HOUSEKEEPING → AVAILABLE).",
                          confirmLabel: "Mark available",
                          tone: "brand",
                          action: () =>
                            markBedAvailable(
                              {
                                id: item.bedId,
                                bedIdentifier: item.bedIdentifier,
                              },
                              "Housekeeping complete",
                            ),
                        })
                      }
                    >
                      Done
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionPanel>

          <SectionPanel
            title="Awaiting bed"
            subtitle="Doctor advised admission, bed not given yet"
            icon={<Users className="size-4.5" />}
          >
            {loading ? (
              <ListSkeleton rows={1} className="-mx-4 -my-4" />
            ) : pendingAdmissions.length === 0 ? (
              <EmptyState
                title="Everyone has a bed"
                description="No admitted patient is waiting for a bed right now."
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {pendingAdmissions.map((admission) => (
                  <li
                    key={admission.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink-800">
                        {patientName(admission)}
                      </p>
                      <p className="num truncate text-[11.5px] text-ink-400">
                        {admission.admissionNo} ·{" "}
                        {admission.patient?.uhid ?? "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`/ipd/admissions/${admission.id}`)
                        }
                      >
                        Chart
                      </Button>
                      <Button
                        size="sm"
                        icon={<BedDouble />}
                        disabled={!canCreate("ipd")}
                        onClick={() => setAssignTarget(admission)}
                      >
                        Assign
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionPanel>

          <SectionPanel
            title="Occupancy by ward type"
            subtitle="Countable beds only (BOR basis)"
            icon={<TrendingUp className="size-4.5" />}
          >
            {loading ? (
              <ul className="space-y-3" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </li>
                ))}
              </ul>
            ) : !bor?.byRoomType?.length ? (
              <p className="py-3 text-center text-[12.5px] text-ink-400">
                No countable beds configured yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {bor.byRoomType.map((row) => (
                  <li key={row.roomType}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium text-ink-700">
                        {row.roomType}
                      </span>
                      <span className="num text-[11.5px] text-ink-500">
                        {row.occupied}/{row.total} · {row.bor}%
                      </span>
                    </div>
                    <Progress
                      value={row.bor}
                      tone={row.bor >= 90 ? "coral" : row.bor >= 70 ? "amber" : "mint"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionPanel>
        </div>
      </div>

      {/* the endpoints behind this now exist — clinical work lives on the chart */}
      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-400">
        Clinical recording — vitals, medicines, rounds and the running bill —
        lives on each patient's chart: open the stay from{" "}
        <button
          type="button"
          onClick={() => navigate("/ipd/admissions")}
          className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700"
        >
          the census
        </button>
        .
      </p>

      <AssignBedDialog
        open={!!assignTarget}
        onOpenChange={(v) => !v && setAssignTarget(null)}
        admission={assignTarget}
        onDone={() => void loadAll()}
      />

      {confirmNode}
    </>
  );
}

export default IpdWardBoardPage;
