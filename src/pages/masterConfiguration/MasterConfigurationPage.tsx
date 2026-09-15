import { useState } from "react";
import {
  ClipboardList,
  Percent,
  Plus,
  Settings,
  Shield,
  UserCog,
} from "lucide-react";
import { PageIntro } from "@/components/common";
import {
  Button,
  Kpi,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { Select } from "@/components/ui/fields";
import { DataTable, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";
import { GlobalConfiguration } from "@/pages/masterConfiguration/GlobalConfiguration";
import { PanelMaster } from "@/pages/masterConfiguration/PanelMaster";
import { InvestigationMaster } from "@/pages/masterConfiguration/InvestigationMaster";
import {
  LAB_ITEMS,
  PANELS,
  type ItemType,
  type LabItem,
  type ModalType,
  type PanelItem,
} from "@/types/masterConfig.data";

const ITEM_TYPES = [
  { value: "laboratory", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "medical", label: "Medical Items" },
  { value: "others", label: "Others Item" },
];

const LAB_COLUMNS: Column<LabItem>[] = [
  {
    key: "code",
    header: "Code",
    render: (r) => (
      <span className="font-mono text-[12px] text-ink-500">{r.code}</span>
    ),
  },
  {
    key: "name",
    header: "Name",
    render: (r) => <span className="font-medium text-ink-900">{r.name}</span>,
  },
  { key: "category", header: "Category", hideBelow: "md" },
  { key: "unit", header: "Unit", hideBelow: "lg" },
  {
    key: "rate",
    header: "Rate",
    align: "right",
    render: (r) => <span className="font-semibold">₹{r.rate}</span>,
  },
  {
    key: "active",
    header: "Status",
    render: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
  },
];

const PANEL_COLUMNS: Column<PanelItem>[] = [
  {
    key: "name",
    header: "Panel",
    render: (r) => <span className="font-medium text-ink-900">{r.name}</span>,
  },
  { key: "type", header: "Type" },
  { key: "insurer", header: "Insurer", hideBelow: "md" },
  {
    key: "active",
    header: "Status",
    render: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
  },
];

/** Local card — Kpi has no icon/click affordance, so wrap the shared Panel. */
function MasterCard({
  icon,
  title,
  subtitle,
  count,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Panel
      as={onClick ? "button" : "div"}
      className={cn(
        "p-5 text-left transition-all",
        onClick &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop",
      )}
      {...(onClick ? { onClick, type: "button" } : {})}
    >
      <span className="mb-3 grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600 [&>svg]:size-5">
        {icon}
      </span>
      <p className="text-[13px] font-semibold text-ink-900">{title}</p>
      <p className="text-[11.5px] text-ink-400">{subtitle}</p>
      <p className="mt-2 text-[15px] font-semibold text-ink-900">{count}</p>
      {children}
    </Panel>
  );
}

export function MasterConfigurationPage() {
  const dispatch = useAppDispatch();
  const [activeModal, setActiveModal] = useState<ModalType>("");
  const [itemType, setItemType] = useState<ItemType>("");

  const openItemModal = (type: string) => {
    if (!type) return;
    setItemType(type as ItemType);
    setActiveModal("investigation");
  };

  const closeModal = () => {
    setActiveModal("");
    setItemType("");
  };

  const comingSoon = (title: string) => () =>
    dispatch(toast.info(title, "Coming soon"));

  return (
    <div className="w-full">
      <PageIntro
        title="Master Configuration"
        description="Manage all master data and system configuration."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          icon={<UserCog />}
          label="Doctor Management"
          tone="lagoon"
          value="28 Doctors"
          hint="Manage doctors & slots"
          onClick={comingSoon("Doctor Management")}
        />
        <Kpi
          icon={<Shield />}
          label="Panel Management"
          tone="brand"
          value="16 Panels"
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
          label="Rate Management"
          tone="amber"
          value="563 Rate Plans"
          hint="Insurance & Corporate Rates"
          onClick={comingSoon("Rate Management")}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <DataTable<LabItem>
          columns={LAB_COLUMNS}
          rows={LAB_ITEMS}
          dense
          rowKey={(r) => r.code}
          clickRowHint={false}
          header={
            <PanelHeader
              title="Lab Items"
              action={
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus />}
                  onClick={() => openItemModal("laboratory")}
                >
                  Add Item
                </Button>
              }
            />
          }
        />

        <DataTable<PanelItem>
          columns={PANEL_COLUMNS}
          rows={PANELS}
          dense
          rowKey={(r) => r.name}
          clickRowHint={false}
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

      <PanelMaster
        open={activeModal === "panel"}
        onOpenChange={(v) => !v && closeModal()}
      />
      <InvestigationMaster
        open={activeModal === "investigation"}
        itemType={itemType}
        onOpenChange={(v) => !v && closeModal()}
      />
      <GlobalConfiguration
        open={activeModal === "global"}
        onOpenChange={(v) => !v && closeModal()}
      />
    </div>
  );
}
