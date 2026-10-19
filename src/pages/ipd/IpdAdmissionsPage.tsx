/**
 * IPD admission census — `/ipd/admissions`.
 *
 * The running list of admissions with the lifecycle actions the backend
 * actually supports today:
 *
 *   ADMITTED         → assign bed · transfer bed · order discharge · cancel
 *                      (cancel only while no bed is assigned — server rule)
 *   DISCHARGE_ORDERED→ complete discharge · transfer still allowed before exit
 *   DISCHARGED       → read-only (chart keeps the summary)
 *   CANCELLED        → read-only
 *
 * Reads:  GET /api/ipd/admissions?status=&page=&limit=… (+ /active shorthand)
 * Writes: assign-bed / transfer-bed / initiate-discharge / complete-discharge /
 *         cancel — all through `ipdService`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  BedDouble,
  Eye,
  LogOut,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { usePermission, useTable } from "@/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Avatar, Badge, Button, Panel } from "@/components/ui/primitives";
import { Select } from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { useConfirmDialog } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/feedback";
import { PageIntro } from "@/components/common";
import { formatDate } from "@/utils";
import { ipdService } from "./ipd.service";
import {
  type IpdAdmission,
  bedLabel,
  doctorName,
  num,
  patientName,
  stayDays,
} from "@/types/ipdTypes";
import {
  AdmissionStatusBadge,
  AssignBedDialog,
  CancelAdmissionDialog,
  Chip,
  TransferBedDialog,
} from "./components";

type DialogKind = "assign" | "transfer" | "cancel" | null;

const PAGE_SIZE = 20;

export function IpdAdmissionsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { canEdit } = usePermission();
  const { ask, confirmNode } = useConfirmDialog();

  const [rows, setRows] = useState<IpdAdmission[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(""); // yyyy-mm-dd
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [target, setTarget] = useState<IpdAdmission | null>(null);

  /* ------------------------------- loading -------------------------------- */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ipdService.fetchAdmissions({
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit: pageSize,
        // a single calendar day → same from/to (server compares admissionDate)
        ...(dateFilter ? { dateFrom: dateFilter, dateTo: dateFilter } : {}),
      });
      if (res.status === 200) {
        setRows(res.data?.data ?? []);
        setMeta(res.data?.meta ?? { total: 0, page: 1, totalPages: 1 });
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not load admissions");
      dispatch(toast.error("Could not load admissions", e?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch, statusFilter, dateFilter, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------ client table ----------------------------- */

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        typeFilter === "all" ? true : row.admissionType === typeFilter,
      ),
    [rows, typeFilter],
  );

  const table = useTable<IpdAdmission>(filteredRows, {
    pageSize: pageSize,
    searchFields: [
      (a) => `${patientName(a)} ${a.patient?.uhid ?? ""} ${a.admissionNo}`,
      (a) => a.bed?.bedIdentifier ?? "",
      (a) => a.panel?.panelName ?? "",
      (a) => a.provisionalDiagnosis ?? "",
    ],
    sortAccessors: {
      admissionNo: (a) => a.admissionNo,
      admissionDate: (a) => a.admissionDate,
      patient: (a) => patientName(a).toLowerCase(),
      bed: (a) => a.bed?.bedIdentifier ?? "",
    },
  });

  /* -------------------------------- actions -------------------------------- */

  const openDialog = (kind: DialogKind, admission: IpdAdmission) => {
    setTarget(admission);
    setDialog(kind);
  };

  const completeDischarge = useCallback(
    async (admission: IpdAdmission) => {
      try {
        await ipdService.completeDischarge(admission.id);
        dispatch(
          toast.success(
            "Discharge completed",
            "The bed has moved to housekeeping and the patient is off the census.",
          ),
        );
        void load();
      } catch (e: any) {
        dispatch(toast.error("Could not complete discharge", e?.message));
      }
    },
    [dispatch, load],
  );

  /* --------------------------------- render -------------------------------- */

  const status = loading ? "loading" : error ? "error" : "ready";

  return (
    <>
      <PageIntro
        title="Admission census"
        description="Every admission of the hospital with its bed, doctor, panel and discharge state. Bed movement and discharge actions run the same state machine the nursing staff sees on the ward board."
        module="ipd"
        back
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              icon={<BedDouble />}
              onClick={() => navigate("/ipd")}
            >
              Ward board
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw />}
              onClick={() => void load()}
            >
              Refresh
            </Button>
          </>
        }
        onCreate={() => navigate("/ipd/admissions/new")}
        createLabel="New admission"
        meta={
          loading && !rows.length ? (
            <>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-40 rounded-full" />
            </>
          ) : (
            <>
              <Badge tone="neutral">{meta.total} total</Badge>
              <Badge tone="mint" dot>
                {rows.filter((a) => a.status === "ADMITTED").length} admitted
              </Badge>
              <Badge tone="amber">
                {rows.filter((a) => a.status === "DISCHARGE_ORDERED").length}{" "}
                awaiting discharge
              </Badge>
            </>
          )
        }
      />

      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search admission no, patient, UHID, bed, panel…"
          filters={
            <>
              <Select
                size="sm"
                className="w-[10.5rem]"
                name="admStatus"
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "Any status" },
                  { value: "ADMITTED", label: "Admitted" },
                  { value: "DISCHARGE_ORDERED", label: "Discharge ordered" },
                  { value: "DISCHARGED", label: "Discharged" },
                  { value: "CANCELLED", label: "Cancelled" },
                ]}
              />
              <Select
                size="sm"
                className="w-[9.5rem]"
                name="admType"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "all", label: "Any type" },
                  { value: "EMERGENCY", label: "Emergency" },
                  { value: "PLANNED", label: "Planned" },
                  { value: "TRANSFER", label: "Transfer" },
                  { value: "DAYCARE", label: "Daycare" },
                ]}
              />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Admission date"
                className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-[12px] text-ink-600"
              />
            </>
          }
        />

        <DataTable
          columns={[
            {
              key: "patient",
              header: "Patient",
              sortable: true,
              render: (a) => (
                <div className="flex items-center gap-3">
                  <Avatar
                    name={patientName(a)}
                    size="sm"
                    color={
                      a.patient?.gender === "FEMALE"
                        ? "bg-lagoon-500"
                        : "bg-brand-500"
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-ink-900">
                      {patientName(a)}
                    </p>
                    <p className="num truncate text-[11.5px] text-ink-400">
                      {a.patient?.uhid ?? "—"} · {a.admissionNo}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: "bed",
              header: "Bed / ward",
              sortable: true,
              render: (a) => (
                <div className="min-w-0">
                  <p className="num truncate text-[12.5px] font-medium text-ink-800">
                    {bedLabel(a)}
                  </p>
                  <p className="truncate text-[11.5px] text-ink-400">
                    {a.bed?.room?.roomType?.name ?? "—"}
                    {a.bed?.room?.roomNumber
                      ? ` · ${a.bed.room.roomNumber}`
                      : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "doctor",
              header: "Doctor",
              hideBelow: "lg",
              render: (a) => (
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] text-ink-700">
                    {doctorName(a)}
                  </p>
                  <p className="truncate text-[11.5px] text-ink-400">
                    {a.doctorProfile?.clinicalDepartment?.name ?? "—"}
                  </p>
                </div>
              ),
            },
            {
              key: "panel",
              header: "Panel",
              hideBelow: "xl",
              render: (a) =>
                a.panel ? (
                  <Chip tone="lagoon">{a.panel.panelName}</Chip>
                ) : (
                  <Chip>Self pay</Chip>
                ),
            },
            {
              key: "admissionDate",
              header: "Admitted",
              sortable: true,
              hideBelow: "lg",
              render: (a) => (
                <div>
                  <p className="text-[12.5px] text-ink-700">
                    {formatDate(a.admissionDate)}
                  </p>
                  <p className="text-[11.5px] text-ink-400">
                    Day {stayDays(a)}
                  </p>
                </div>
              ),
            },
            {
              key: "type",
              header: "Type",
              hideBelow: "md",
              render: (a) => (
                <Chip
                  tone={
                    a.admissionType === "EMERGENCY"
                      ? "coral"
                      : a.admissionType === "DAYCARE"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {a.admissionType}
                </Chip>
              ),
            },
            {
              key: "advance",
              header: "Advance",
              align: "right",
              hideBelow: "xl",
              render: (a) => (
                <span className="num text-[12.5px] font-medium text-ink-700">
                  ₹{num(a.advancePaid).toLocaleString("en-IN")}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              align: "center",
              render: (a) => <AdmissionStatusBadge status={a.status} />,
            },
          ]}
          rows={table.rows}
          status={status}
          error={error}
          onRetry={() => void load()}
          sort={{
            sortBy: table.query.sortBy,
            sortDir: table.query.sortDir,
            onSort: table.toggleSort,
          }}
          onRowClick={(a) => navigate(`/ipd/admissions/${a.id}`)}
          actions={(a) => {
            const admitted = a.status === "ADMITTED";
            const ordered = a.status === "DISCHARGE_ORDERED";
            return (
              <RowActions
                items={[
                  {
                    label: "Open chart",
                    icon: <Eye />,
                    onClick: () => navigate(`/ipd/admissions/${a.id}`),
                  },
                  {
                    label: "Assign bed",
                    icon: <BedDouble />,
                    hidden: !admitted || !!a.bedId || !canEdit("ipd"),
                    onClick: () => openDialog("assign", a),
                  },
                  {
                    label: "Transfer bed",
                    icon: <ArrowLeftRight />,
                    hidden:
                      !(admitted || ordered) || !a.bedId || !canEdit("ipd"),
                    onClick: () => openDialog("transfer", a),
                  },
                  {
                    label: "Order discharge",
                    icon: <LogOut />,
                    hidden: !admitted || !canEdit("ipd"),
                    onClick: () =>
                      navigate(`/ipd/admissions/${a.id}/discharge`),
                  },
                  {
                    label: "Complete discharge",
                    icon: <LogOut />,
                    tone: "brand",
                    hidden: !ordered || !canEdit("ipd"),
                    onClick: () =>
                      ask({
                        title: `Complete discharge for ${patientName(a)}?`,
                        description:
                          "The patient leaves the census and the bed moves to housekeeping. Do this after the bill is settled — billing endpoints ship in the next backend sprint.",
                        confirmLabel: "Complete discharge",
                        tone: "brand",
                        action: () => completeDischarge(a),
                      }),
                  },
                  {
                    label: "Cancel admission",
                    icon: <XCircle />,
                    tone: "danger",
                    hidden: !admitted || !!a.bedId || !canEdit("ipd"),
                    onClick: () => openDialog("cancel", a),
                  },
                ]}
              />
            );
          }}
          emptyTitle="No admissions yet"
          emptyDescription="Admit a patient from the ward board or the button above to start the IPD lifecycle."
          emptyAction={
            <Button
              size="sm"
              icon={<Plus />}
              onClick={() => navigate("/ipd/admissions/new")}
            >
              New admission
            </Button>
          }
          footer={
            <Pagination
              page={page}
              pageCount={meta.totalPages || 1}
              total={meta.total || rows.length}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              label="admissions"
            />
          }
        />
      </Panel>

      <AssignBedDialog
        open={dialog === "assign"}
        onOpenChange={(v) => !v && setDialog(null)}
        admission={target}
        onDone={() => void load()}
      />
      <TransferBedDialog
        open={dialog === "transfer"}
        onOpenChange={(v) => !v && setDialog(null)}
        admission={target}
        onDone={() => void load()}
      />
      <CancelAdmissionDialog
        open={dialog === "cancel"}
        onOpenChange={(v) => !v && setDialog(null)}
        admission={target}
        onDone={() => void load()}
      />

      {confirmNode}
    </>
  );
}

export default IpdAdmissionsPage;
