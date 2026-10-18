import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { masterService } from "@/pages/masterConfiguration/master.service";
import {
  BedDouble,
  ClipboardList,
  Percent,
  Plus,
  Settings,
  Shield,
  UserCog,
  Building2,
} from "lucide-react";
import { PageIntro } from "@/components/common";
import {
  Button,
  Kpi,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { Select } from "@/components/ui/fields";
import { DataTable, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";

// Modals
import { GlobalConfiguration } from "@/pages/masterConfiguration/GlobalConfiguration";
import { PanelMaster } from "@/pages/masterConfiguration/PanelMaster";
import { InvestigationMaster } from "@/pages/masterConfiguration/InvestigationMaster";
import { TariffMaster } from "./TariffMaster";
import { ServiceMaster } from "./ServiceMaster";
import { WardSetupDialog } from "./WardSetupDialog";

// Live Panel API

import type { PanelMasterItem } from "@/types";

import { type ItemType, type ModalType } from "@/types/masterConfig.data";

const ITEM_TYPES = [
  { value: "laboratory", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "medical", label: "Medical Items" },
  { value: "others", label: "Others Item" },
];

// ─── LIVE PANEL COLUMNS (matches API response) ───────────────────
const PANEL_COLUMNS: Column<PanelMasterItem>[] = [
  {
    key: "panelCode",
    header: "Code",
    width: "w-32",
    render: (r) => (
      <span className="font-mono text-[12px] font-semibold text-brand-600">
        {r.panelCode}
      </span>
    ),
  },
  {
    key: "panelName",
    header: "Panel",
    render: (r) => (
      <div>
        <span className="font-medium text-ink-900">{r.panelName}</span>
        {r.groupType?.value && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-400">
            <Building2 className="h-3 w-3" />
            {r.groupType.value}
          </p>
        )}
      </div>
    ),
  },
  {
    key: "panelType",
    header: "Type",
    hideBelow: "md",
    render: (r) => (
      <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
        {r.panelType?.value ?? "—"}
      </span>
    ),
  },
  {
    key: "creditLimit",
    header: "Credit Limit",
    hideBelow: "lg",
    align: "right",
    render: (r) => (
      <span className="font-medium text-ink-700">
        ₹{Number(r.creditLimit || 0).toLocaleString("en-IN")}
      </span>
    ),
  },
  {
    key: "active",
    header: "Status",
    render: (r) => <StatusBadge status={r.isActive ? "Active" : "Inactive"} />,
  },
];

export function MasterConfigurationPage() {
  const dispatch = useAppDispatch();
  const [activeModal, setActiveModal] = useState<
    ModalType | "service-master" | "rate-managment" | "ward-setup" | ""
  >("");

  /**
   * Ward setup is a dialog on this page, not a screen of its own. The ward
   * board links here with `?open=ward-setup` (and the old `/ipd/setup` +
   * `/master-config/ward-setup` paths redirect to the same URL), so the hub
   * opens the dialog for that link and then cleans the query away.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("open") === "ward-setup") {
      setActiveModal("ward-setup");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [itemType, setItemType] = useState<ItemType | "">("");

  // ─── LIVE PANEL STATE ──────────────────────────────────────────
  const [panels, setPanels] = useState<PanelMasterItem[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const [panelCount, setPanelCount] = useState(0);

  const fetchPanels = useCallback(async () => {
    setPanelsLoading(true);
    try {
      const res: any = await masterService.fetchPanels({ limit: "50" });
      const body: any = res.data ?? {};
      setPanels(body.data ?? []);
      setPanelCount(body.meta?.total ?? body.data?.length ?? 0);
    } catch (error: any) {
      dispatch(toast.error("Failed to load panels", error?.message));
    } finally {
      setPanelsLoading(false);
    }
  }, [dispatch]);

  // Load panels on page mount
  useEffect(() => {
    fetchPanels();
  }, [fetchPanels]);

  const openItemModal = (type: string) => {
    if (!type) return;
    setItemType(type as ItemType);
    setActiveModal("investigation");
  };

  const closeModal = () => {
    setActiveModal("");
    setItemType("");
  };

  // When Panel dialog closes → refresh list
  const handlePanelModalChange = (open: boolean) => {
    if (!open) {
      closeModal();
      fetchPanels(); // 👈 refresh after add/edit
    }
  };

  const comingSoon = (title: string) => () =>
    dispatch(toast.info(title, "Coming soon"));

  return (
    <div className="w-full">
      <PageIntro
        title="Master Configuration"
        description="Manage all master data and system configuration."
      />

      {/* ─── KPI CARDS ─────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          icon={<UserCog />}
          label="Doctor Management"
          tone="lagoon"
          value="28 Doctors"
          hint="Manage doctors & slots"
          onClick={comingSoon("Doctor Management")}
        />

        {/* 👇 LIVE PANEL COUNT */}
        <Kpi
          icon={<Shield />}
          label="Panel Management"
          tone="brand"
          value={`${panelCount} Panels`}
          hint="Insurance & Corporate"
          active={activeModal === "panel"}
          onClick={() => setActiveModal("panel")}
        />

        <Kpi
          icon={<ClipboardList />}
          label="Item Management"
          tone="mint"
          value="1,248 Items"
          hint="Lab, Radio, Pharmacy"
          active={activeModal === "investigation"}
          card
        >
          <Select
            value={itemType}
            onChange={openItemModal}
            options={ITEM_TYPES}
            placeholder="Select item type…"
            size="sm"
            className="mt-3"
          />
        </Kpi>

        <Kpi
          icon={<Percent />}
          label="Service Management"
          tone="amber"
          value="Services"
          hint="Hospital service catalog"
          active={activeModal === "service-master"}
          onClick={() => setActiveModal("service-master")}
        />

        <Kpi
          icon={<Percent />}
          label="Rate Management"
          tone="amber"
          value="Tariffs"
          hint="Insurance & Corporate Rates"
          active={activeModal === "rate-managment"}
          onClick={() => setActiveModal("rate-managment")}
        />

        <Kpi
          icon={<Settings />}
          label="Configuration"
          tone="coral"
          value="24 Settings"
          hint="General & System Settings"
          active={activeModal === "global"}
          onClick={() => setActiveModal("global")}
        />
      </div>

      {/* ─── WARD / ROOM / BED MASTER ───────────────────────────────
          The ward STRUCTURE lives here (master data); IPD runs its
          operational use — occupancy, allocation, transfer, discharge.
          Full-width entry so it does not disturb the KPI grid above. */}
      <div className="mb-6">
        <Kpi
          icon={<BedDouble />}
          label="Ward, Room & Bed Setup"
          tone="brand"
          value="Wards & beds"
          hint="Room types · rooms · beds (single + bulk) · amenities"
          active={activeModal === "ward-setup"}
          onClick={() => setActiveModal("ward-setup")}
        />
      </div>

      {/* ─── TWO TABLES ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-1">
        {/* 👇 LIVE PANEL TABLE */}
        <DataTable<PanelMasterItem>
          columns={PANEL_COLUMNS}
          rows={panels}
          status={panelsLoading ? "loading" : "ready"}
          dense
          rowKey={(r) => r.id}
          clickRowHint={false}
          emptyTitle="No panels registered"
          emptyDescription="Click 'Add Panel' to register your first insurance or corporate panel."
          header={
            <PanelHeader
              title="Panel / Insurance Registration"
              action={
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus />}
                  onClick={() => setActiveModal("panel")}
                >
                  Add Panel
                </Button>
              }
            />
          }
        />
      </div>

      {/* ─── MODALS ────────────────────────────────────────────────── */}
      <PanelMaster
        open={activeModal === "panel"}
        onOpenChange={handlePanelModalChange}
      />
      <InvestigationMaster
        open={activeModal === "investigation"}
        itemType={itemType as ItemType}
        onOpenChange={(v) => !v && closeModal()}
      />
      <GlobalConfiguration
        open={activeModal === "global"}
        onOpenChange={(v) => !v && closeModal()}
      />
      <TariffMaster
        open={activeModal === "rate-managment"}
        onOpenChange={(v) => !v && closeModal()}
      />
      <ServiceMaster
        open={activeModal === "service-master"}
        onOpenChange={(v) => !v && closeModal()}
      />
      <WardSetupDialog
        open={activeModal === "ward-setup"}
        onOpenChange={(v) => !v && closeModal()}
      />
    </div>
  );
}
