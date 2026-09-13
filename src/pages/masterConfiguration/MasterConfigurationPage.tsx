import React, { useState } from "react";
import {
  UserCog,
  Shield,
  ClipboardList,
  Percent,
  Settings,
  Plus,
  X,
  Search,
  Trash2,
} from "lucide-react";
import { PageIntro } from "@/components/common";
import { Button } from "@/components/ui/primitives";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";

// ============================================
// TYPES
// ============================================
type ItemType = "" | "laboratory" | "radiology" | "medical" | "others";
type ModalType = "" | "panel" | "investigation" | "global";

interface LabItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  active: boolean;
}

interface PanelItem {
  name: string;
  type: string;
  insurer: string;
  active: boolean;
}

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  count: string;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
  extra?: React.ReactNode;
  active?: boolean;
}

// ============================================
// DUMMY DATA
// ============================================
const LAB_ITEMS: LabItem[] = [
  { code: "LAB-1001", name: "Complete Blood Count (CBC)", category: "Hematology", unit: "Each", rate: 300, active: true },
  { code: "LAB-1002", name: "Lipid Profile", category: "Biochemistry", unit: "Each", rate: 800, active: true },
  { code: "LAB-1003", name: "Liver Function Test (LFT)", category: "Biochemistry", unit: "Each", rate: 700, active: true },
  { code: "LAB-1004", name: "Thyroid Profile (T3, T4, TSH)", category: "Hormone", unit: "Each", rate: 900, active: true },
  { code: "LAB-1005", name: "HbA1c", category: "Diabetes", unit: "Each", rate: 600, active: true },
];

const PANELS: PanelItem[] = [
  { name: "Star Health Insurance", type: "Insurance", insurer: "Star Health", active: true },
  { name: "Aditya Birla Health", type: "Insurance", insurer: "Aditya Birla", active: true },
  { name: "HDFC ERGO General", type: "Insurance", insurer: "HDFC ERGO", active: true },
  { name: "Reliance General", type: "Insurance", insurer: "Reliance", active: true },
  { name: "Max Bupa Health", type: "Insurance", insurer: "Max Bupa", active: false },
];

const GLOBAL_CONFIG_GROUPS = [
  {
    section: "PANEL / BILLING",
    items: [
      { key: "groupType", label: "Group Type", count: 4, values: ["INSURANCE", "CORPORATE", "GOVERNMENT", "TPA"] },
      { key: "paymentMode", label: "Payment Mode", count: 6, values: ["CASH", "CARD", "UPI", "CHEQUE", "NEFT", "WALLET"] },
      { key: "rateType", label: "Rate Type", count: 3, values: ["STANDARD", "DISCOUNTED", "PREMIUM"] },
      { key: "currency", label: "Currency", count: 5, values: ["INR", "USD", "EUR", "GBP", "AED"] },
      { key: "panelType", label: "Panel Type", count: 2, values: ["CREDIT", "CASH"] },
      { key: "taxType", label: "Tax Type", count: 4, values: ["GST 5%", "GST 12%", "GST 18%", "EXEMPT"] },
      { key: "discountReason", label: "Discount Reason", count: 4, values: ["STAFF", "SENIOR CITIZEN", "CAMP", "OTHERS"] },
      { key: "refundReason", label: "Refund Reason", count: 3, values: ["DUPLICATE PAYMENT", "SERVICE NOT AVAILED", "PATIENT REQUEST"] },
      { key: "cancellationReason", label: "Cancellation Reason", count: 3, values: ["NO SHOW", "DOCTOR UNAVAILABLE", "PATIENT REQUEST"] },
    ],
  },
  {
    section: "CLINICAL",
    items: [
      { key: "department", label: "Department", count: 5, values: ["General Medicine", "Cardiology", "Orthopedics", "Pediatrics", "Gynecology"] },
      { key: "subDepartment", label: "Sub Department", count: 5, values: ["Biochemistry", "Hematology", "Microbiology", "Serology", "Pathology"] },
      { key: "consultationType", label: "Consultation Type", count: 4, values: ["NEW", "FOLLOW-UP", "TELE", "EMERGENCY"] },
      { key: "diagnosisType", label: "Diagnosis Type", count: 3, values: ["PROVISIONAL", "FINAL", "DIFFERENTIAL"] },
      { key: "dietType", label: "Diet Type", count: 5, values: ["NORMAL", "DIABETIC", "SOFT", "LIQUID", "NPO"] },
      { key: "ward", label: "Ward", count: 5, values: ["GENERAL", "SEMI-PRIVATE", "PRIVATE", "DELUXE", "ICU"] },
    ],
  },
];

const INVESTIGATIONS = [
  "24hrs Urine Protein", "Acid Fast Bacilli Smear Sputum", "Adenosine deaminase (ADA)",
  "Adrenocorticotropic Hormone", "AFB Smear By ZN Stain", "AFP", "AG RATIO",
  "ALAT- GPT", "Albumin", "Alkaline Phosphatase", "Amylase-Pancreatic", "Amylase-Total",
];

// ============================================
// MAIN COMPONENT
// ============================================
export function MasterConfigurationPage() {
  const dispatch = useAppDispatch();
  const [activeModal, setActiveModal] = useState<ModalType>("");
  const [itemType, setItemType] = useState<ItemType>("");

  const handleOpenItemModal = (type: ItemType) => {
    if (!type) return;
    setItemType(type);
    setActiveModal("investigation");
  };

  return (
    <div className="w-full">
      <PageIntro
        title="Master Configuration"
        description="Manage all master data and system configuration."
      />

      {/* Top Stat / Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={UserCog}
          title="Doctor Management"
          subtitle="Manage doctors & slots"
          count="28 Doctors"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          onClick={() => dispatch(toast.info("Doctor Management", "Coming soon"))}
        />
        <StatCard
          icon={Shield}
          title="Panel Management"
          subtitle="Insurance & Corporate"
          count="16 Panels"
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          onClick={() => setActiveModal("panel")}
        />
        <StatCard
          icon={ClipboardList}
          title="Item Management"
          subtitle="Lab, Radio, Pharmacy"
          count="1,248 Items"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          active={activeModal === "investigation" || !!itemType}
          extra={
            <select
              value={itemType}
              onChange={(e) => handleOpenItemModal(e.target.value as ItemType)}
              className="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Select Item Type...</option>
              <option value="laboratory">Laboratory</option>
              <option value="radiology">Radiology</option>
              <option value="medical">Medical Items</option>
              <option value="others">Others Item</option>
            </select>
          }
        />
        <StatCard
          icon={Percent}
          title="Rate Management"
          subtitle="Insurance & Corporate Rates"
          count="563 Rate Plans"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          onClick={() => dispatch(toast.info("Rate Management", "Coming soon"))}
        />
        <StatCard
          icon={Settings}
          title="Configuration"
          subtitle="General & System Settings"
          count="24 Settings"
          iconBg="bg-red-50"
          iconColor="text-red-600"
          onClick={() => setActiveModal("global")}
        />
      </div>

      {/* Bottom Preview Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lab Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Lab Items</h3>
            <button
              type="button"
              onClick={() => handleOpenItemModal("laboratory")}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3">Rate</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {LAB_ITEMS.map((it) => (
                  <tr key={it.code} className="border-b border-gray-100 last:border-0 hover:bg-slate-50/60">
                    <td className="py-3 pr-3 font-mono text-xs text-gray-600">{it.code}</td>
                    <td className="py-3 pr-3 font-medium text-gray-900">{it.name}</td>
                    <td className="py-3 pr-3 text-gray-600">{it.category}</td>
                    <td className="py-3 pr-3 text-gray-600">{it.unit}</td>
                    <td className="py-3 pr-3 font-semibold text-gray-900">₹{it.rate}</td>
                    <td className="py-3">
                      <ActiveBadge active={it.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panels */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Panel / Insurance Registration</h3>
            <Button
            
              onClick={() => setActiveModal("panel")}
              
            >
              <Plus size={14} /> Add Panel
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="py-2 pr-3">Panel</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Insurer</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {PANELS.map((p) => (
                  <tr key={p.name} className="border-b border-gray-100 last:border-0 hover:bg-slate-50/60">
                    <td className="py-3 pr-3 font-medium text-gray-900">{p.name}</td>
                    <td className="py-3 pr-3 text-gray-600">{p.type}</td>
                    <td className="py-3 pr-3 text-gray-600">{p.insurer}</td>
                    <td className="py-3">
                      <ActiveBadge active={p.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeModal === "panel" && (
        <PanelMasterModal onClose={() => setActiveModal("")} />
      )}
      {activeModal === "investigation" && (
        <InvestigationModal
          itemType={itemType}
          onClose={() => {
            setActiveModal("");
            setItemType("");
          }}
        />
      )}
      {activeModal === "global" && (
        <GlobalConfigModal onClose={() => setActiveModal("")} />
      )}
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================
function StatCard({
  icon: Icon,
  title,
  subtitle,
  count,
  iconBg,
  iconColor,
  onClick,
  extra,
  active,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
        active ? "border-teal-500 ring-1 ring-teal-500" : "border-gray-200"
      }`}
    >
      <div className={`w-11 h-11 rounded-lg ${iconBg} flex items-center justify-center mb-4`}>
        <Icon className={iconColor} size={22} />
      </div>
      <h3 className="font-bold text-gray-900 text-base">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
      <p className="font-bold text-gray-900 text-sm">{count}</p>
      {extra}
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
      Inactive
    </span>
  );
}

// ============================================
// MODAL WRAPPER
// ============================================
function ModalShell({
  title,
  description,
  onClose,
  children,
  size = "xl",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
}) {
  const sizes = {
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    "2xl": "max-w-7xl",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${sizes[size]} max-h-[92vh] flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
          </div>
          <Button
           
            onClick={onClose}
           
          >
            <X size={18} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// PANEL MASTER MODAL
// ============================================
function PanelMasterModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [panelName, setPanelName] = useState("");

  const handleSave = () => {
    if (!panelName.trim()) {
      dispatch(toast.warning("Panel Name is required"));
      return;
    }
    dispatch(toast.success("Panel saved successfully", panelName));
    onClose();
  };

  return (
    <ModalShell title="Panel Master" description="Register a new insurance / corporate panel" onClose={onClose}>
      <div className="p-6">
        <div className="bg-cyan-50 border-l-4 border-cyan-500 px-4 py-2 mb-4">
          <h3 className="text-cyan-700 font-semibold text-sm">Panel Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
          <FormField label="Panel Name" required>
            <input
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
              className="input-master border-red-300"
            />
          </FormField>
          <FormField label="Group Type">
            <select className="input-master">
              <option>INSURANCE</option>
              <option>CORPORATE</option>
              <option>GOVERNMENT</option>
              <option>TPA</option>
            </select>
          </FormField>
          <FormField label="Contact Person"><input className="input-master" /></FormField>

          <FormField label="Address 1"><input className="input-master" /></FormField>
          <FormField label="Address 2"><input className="input-master" /></FormField>
          <FormField label="Contact No."><input className="input-master" /></FormField>

          <FormField label="Phone No."><input className="input-master" /></FormField>
          <FormField label="Email ID"><input className="input-master" type="email" /></FormField>
          <FormField label="Fax No."><input className="input-master" /></FormField>

          <FormField label="Valid From"><input type="date" className="input-master" /></FormField>
          <FormField label="Valid To"><input type="date" className="input-master" /></FormField>
          <FormField label="Payment Mode">
            <select className="input-master">
              <option value="">Select</option>
              <option>CASH</option>
              <option>CARD</option>
              <option>UPI</option>
            </select>
          </FormField>

          <FormField label="Refer Rate (OPD)">
            <select className="input-master"><option>CASH</option></select>
          </FormField>
          <FormField label="Refer Rate (IPD)">
            <select className="input-master"><option>CASH</option></select>
          </FormField>
          <FormField label="Credit Limits"><input type="number" className="input-master" /></FormField>

          <FormField label="Rate Type">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="checkbox" /> SELF (OPD)</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="checkbox" /> SELF (IPD)</label>
            </div>
          </FormField>
          <FormField label="Show PrintOut">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="print" defaultChecked /> Yes</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="print" /> No</label>
            </div>
          </FormField>
          <FormField label="Hide Rate">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="hiderate" /> Yes</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="hiderate" defaultChecked /> No</label>
            </div>
          </FormField>

          <FormField label="Co-Payment On">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="copay" defaultChecked /> On Bill</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="copay" /> On Service</label>
            </div>
          </FormField>
          <FormField label="Co-Payment (%)"><input type="number" className="input-master" /></FormField>
          <FormField label="Rate Currency">
            <select className="input-master"><option>INR</option><option>USD</option></select>
          </FormField>

          <FormField label="Panel Type">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="ptype" defaultChecked /> Credit</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="ptype" /> Cash</label>
            </div>
          </FormField>
          <FormField label="Bill Currency">
            <select className="input-master"><option>INR</option></select>
          </FormField>
          <FormField label="Currency Conv."><input type="number" defaultValue={1} className="input-master" /></FormField>

          <FormField label="Cover Note">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="cover" defaultChecked /> No</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="cover" /> Yes</label>
            </div>
          </FormField>
          <FormField label="Panel Amount"><input type="number" className="input-master" /></FormField>
          <FormField label="Diet Type">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="diet" defaultChecked /> Normal</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="diet" /> Private</label>
            </div>
          </FormField>

          <FormField label="Is Smart Card">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="smart" defaultChecked /> No</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="smart" /> Yes</label>
            </div>
          </FormField>
          <FormField label="Encounter">
            <div className="pt-1.5"><input type="checkbox" /></div>
          </FormField>
          <FormField label="Is USD Based">
            <div className="pt-1.5"><input type="checkbox" /></div>
          </FormField>
        </div>

        <div className="mt-6 pt-4 border-t border-dashed border-gray-300 text-xs space-y-1">
          <p className="text-red-600"><span className="text-gray-500 mr-1">Note:</span> Co-Payment Payable By Patient.</p>
          <p className="text-red-600"><span className="text-gray-500 mr-1">Note:</span> Enter the USD ($) conversion factor for 1 US Dollar cost in INR.</p>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex justify-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>

      {/* Inline styles for consistent inputs */}
      <style>{`
        .input-master {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background: white;
          outline: none;
        }
        .input-master:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 1px #0d9488;
        }
      `}</style>
    </ModalShell>
  );
}

// ============================================
// INVESTIGATION / ITEM MODAL
// ============================================
function InvestigationModal({ itemType, onClose }: { itemType: ItemType; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [selectedInv, setSelectedInv] = useState("");
  const [search, setSearch] = useState("");

  const typeLabel = itemType
    ? itemType.charAt(0).toUpperCase() + itemType.slice(1)
    : "Item";

  const filtered = INVESTIGATIONS.filter((inv) =>
    inv.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    dispatch(toast.success("Investigation saved", selectedInv || "New investigation"));
    onClose();
  };

  return (
    <ModalShell
      title={`Manage Investigations — ${typeLabel}`}
      onClose={onClose}
      size="2xl"
    >
      <div className="p-6">
        {/* Top Row */}
        <div className="flex items-center gap-6 mb-5 pb-4 border-b border-gray-200">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" /> New Investigation
          </label>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Department :</label>
            <select className="input-master !w-40">
              <option>ALL</option>
              <option>Biochemistry</option>
              <option>Hematology</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left - List */}
          <div className="lg:col-span-1 border border-gray-200 rounded-lg p-4 bg-slate-50/50">
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Investigations</h4>
            <div className="flex items-center gap-4 mb-3 text-xs">
              <label className="flex items-center gap-1"><input type="radio" name="filter" /> Code</label>
              <label className="flex items-center gap-1"><input type="radio" name="filter" defaultChecked /> First Name</label>
              <label className="flex items-center gap-1"><input type="radio" name="filter" /> InBetween</label>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-0.5 max-h-96 overflow-y-auto bg-white rounded border border-gray-200 p-1">
              {filtered.map((inv) => (
                <div
                  key={inv}
                  onClick={() => setSelectedInv(inv)}
                  className={`px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-teal-50 ${
                    selectedInv === inv ? "bg-teal-100 text-teal-800 font-medium" : "text-gray-700"
                  }`}
                >
                  # {inv}
                </div>
              ))}
            </div>
          </div>

          {/* Right - Form */}
          <div className="lg:col-span-3">
            <div className="bg-cyan-50 border-l-4 border-cyan-500 px-4 py-2 mb-4">
              <h3 className="text-cyan-700 font-semibold text-sm">Detail</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <FormField label="Sub. Dept">
                <select className="input-master">
                  <option>BIOCHEMISTRY</option>
                  <option>HEMATOLOGY</option>
                </select>
              </FormField>
              <FormField label="Investigation" required>
                <input value={selectedInv} onChange={(e) => setSelectedInv(e.target.value)} className="input-master border-red-300" />
              </FormField>

              <FormField label="Description"><input className="input-master" /></FormField>
              <FormField label="Method"><input className="input-master" /></FormField>

              <FormField label="Gender">
                <select className="input-master"><option>Both</option><option>Male</option><option>Female</option></select>
              </FormField>
              <FormField label="Report Type">
                <select className="input-master"><option>Path Numeric</option><option>Path Text</option></select>
              </FormField>

              <FormField label="Type">
                <select className="input-master"><option>Sample Required</option></select>
              </FormField>
              <FormField label="Print Sequence"><input type="number" className="input-master" /></FormField>

              <FormField label="Sample Type">
                <select className="input-master border-red-300"><option value="">Select</option><option>Blood</option><option>Urine</option></select>
              </FormField>
              <FormField label="Sample Con.">
                <select className="input-master"><option>Normal</option></select>
              </FormField>

              <FormField label="Department">
                <select className="input-master border-red-300"><option value="">Select</option><option>Pathology</option></select>
              </FormField>
              <FormField label="Is Discountable">
                <div className="flex items-center gap-4 pt-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="disc" /> Yes</label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="disc" defaultChecked /> No</label>
                </div>
              </FormField>

              <FormField label="LIS Test Code"><input className="input-master" /></FormField>
              <FormField label="Rate Editable">
                <div className="flex items-center gap-4 pt-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="rate" /> Yes</label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="rate" defaultChecked /> No</label>
                </div>
              </FormField>

              <FormField label="Exam Type">
                <div className="flex items-center gap-4 pt-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="exam" defaultChecked /> General</label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="radio" name="exam" /> Obstetrics</label>
                </div>
              </FormField>
              <FormField label="TAT Time & Type">
                <div className="flex items-center gap-2">
                  <input className="input-master" placeholder="Time" />
                  <select className="input-master !w-32"><option>Select</option><option>Hours</option><option>Days</option></select>
                </div>
              </FormField>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-sm text-gray-900 mb-3">Other Information</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Show Name in Patient Report</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Show in Online Report</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Print Separate</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> PrintSampleName</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> IsCulture</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Urgent</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Active</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Outsource</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Profile Test</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex justify-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>

      <style>{`
        .input-master {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background: white;
          outline: none;
        }
        .input-master:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 1px #0d9488;
        }
      `}</style>
    </ModalShell>
  );
}

// ============================================
// GLOBAL MASTER CONFIG MODAL
// ============================================
function GlobalConfigModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [activeKey, setActiveKey] = useState("groupType");
  const [newValue, setNewValue] = useState("");
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    GLOBAL_CONFIG_GROUPS.forEach((g) =>
      g.items.forEach((it) => {
        initial[it.key] = [...it.values];
      })
    );
    return initial;
  });

  const activeItem = GLOBAL_CONFIG_GROUPS.flatMap((g) => g.items).find((i) => i.key === activeKey);
  const activeValues = values[activeKey] || [];
  const filtered = activeValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = () => {
    if (!newValue.trim()) {
      dispatch(toast.warning("Please enter a value"));
      return;
    }
    setValues((prev) => ({
      ...prev,
      [activeKey]: [...(prev[activeKey] || []), newValue.trim().toUpperCase()],
    }));
    setNewValue("");
    dispatch(toast.success("Value added"));
  };

  const handleDelete = (index: number) => {
    setValues((prev) => ({
      ...prev,
      [activeKey]: prev[activeKey].filter((_, i) => i !== index),
    }));
    dispatch(toast.info("Value removed"));
  };

  const handleUpdate = (index: number, val: string) => {
    setValues((prev) => ({
      ...prev,
      [activeKey]: prev[activeKey].map((v, i) => (i === index ? val : v)),
    }));
  };

  const handleSaveAll = () => {
    dispatch(toast.success("Global configuration saved successfully"));
    onClose();
  };

  return (
    <ModalShell
      title="Global Master Configuration"
      description="Manage all dropdown lists used across the application from a single screen"
      onClose={onClose}
      size="2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
        {/* Sidebar */}
        <div className="md:col-span-1 border-r border-gray-200 bg-slate-50 overflow-y-auto max-h-[70vh]">
          {GLOBAL_CONFIG_GROUPS.map((group) => (
            <div key={group.section} className="py-2">
              <div className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                {group.section}
              </div>
              {group.items.map((it) => {
                const isActive = activeKey === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setActiveKey(it.key)}
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors ${
                      isActive
                        ? "bg-brand-600 text-white font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>{it.label}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isActive ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {values[it.key]?.length ?? it.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="md:col-span-3 p-6">
          <h3 className="font-bold text-lg text-gray-900">{activeItem?.label}</h3>
          <p className="text-sm text-gray-500 mb-5">
            Add, edit or remove options that appear in the "{activeItem?.label}" dropdown.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`Add new ${activeItem?.label}...`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50"
            />
            <Button
             
              onClick={handleAdd}
            
            >
              <Plus size={14} /> Add
            </Button>
          </div>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50"
            />
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-100 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
              <div className="col-span-1 px-4 py-2">#</div>
              <div className="col-span-9 px-4 py-2">Value</div>
              <div className="col-span-2 px-4 py-2 text-right">Action</div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filtered.map((val, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center border-b border-gray-100 last:border-0 hover:bg-slate-50"
                >
                  <div className="col-span-1 px-4 py-2 text-sm text-gray-500">{idx + 1}</div>
                  <div className="col-span-9 px-4 py-2">
                    <input
                      value={val}
                      onChange={(e) => handleUpdate(idx, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-slate-50/70 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="text-xs px-3 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">No values found.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button

          onClick={handleSaveAll}
        
        >
          Save Changes
        </Button>
      </div>
    </ModalShell>
  );
}

// ============================================
// SHARED FORM FIELD
// ============================================
function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}