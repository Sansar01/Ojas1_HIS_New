﻿import { FormRow } from "@/components/common";
import { Input, Select, Switch, Textarea } from "@/components/ui/fields";
import { Dialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { departmentsApi } from "@/features/slices";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { Department } from "@/types";
import { fullName } from "@/utils";

export function DepartmentFormDialog({
  initial,
  onClose,
}: {
  initial: Partial<Department>;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const doctors = useRootSelector((s) => s.doctors.items);
  const form = useForm({
    initialValues: {
      name: initial.name ?? "",
      code: initial.code ?? "",
      description: initial.description ?? "",
      floor: initial.floor ?? "",
      headDoctorId: initial.headDoctorId ?? "",
      // Edited from this dialog via the switch below; new departments default
      // to active.
      isActive: (initial.id ? initial.status === "active" : true) as boolean,
    },
    schema: {
      name: [{ required: "Department name is required", min: 3 }],
    },
  });

  const save = form.handleSubmit(async (values) => {
    // The departments endpoint is a master resource: it accepts name, code,
    // description and the isActive flag (see mastersService / MasterRecord).
    const data = {
      name: values.name,
      // Mirror the backend DTO transform so the value we show/persist locally
      // matches what the API stores: trim, upper-case, non-alphanumerics -> "_".
      code: values.code
        ? values.code
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
        : undefined,
      description: values.description,
      // Switch below drives the API's isActive flag.
      isActive: values.isActive,
    };
    if (initial.id)
      await dispatch(
        departmentsApi.thunks.updateOne({
          id: initial.id,
          data,
          successMessage: "Department updated",
        } as any),
      );
    else
      await dispatch(
        departmentsApi.thunks.createOne({
          data,
          successMessage: "Department created",
        } as any),
      );
    onClose();
  });

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={initial.id ? `Edit ${initial.name}` : "Add department"}
      description="Code and floor help staff route patients quickly."
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={form.submitting} onClick={save}>
            {initial.id ? "Save department" : "Create department"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <FormRow>
          <Input
            name="name"
            label="Department name"
            required
            placeholder="Cardiac Sciences"
            value={form.values.name}
            onChange={(e) => form.setValue("name", e.target.value)}
            error={form.errors.name}
          />
          <Input
            name="code"
            label="Code"
            placeholder="CARDIAC_SCIENCES"
            hint="Optional - up to 50 characters"
            value={form.values.code}
            onChange={(e) => form.setValue("code", e.target.value)}
            error={form.errors.code}
            className="uppercase"
          />
          <Input
            name="floor"
            label="Location / floor"
            placeholder="Block A - 4th"
            value={form.values.floor}
            onChange={(e) => form.setValue("floor", e.target.value)}
          />
          <Select
            name="headDoctorId"
            label="Head of department"
            clearable
            value={form.values.headDoctorId ?? ""}
            onChange={(v: any) => form.setValue("headDoctorId", v)}
            options={doctors.map((d: any) => ({
              value: d.id,
              label: `Dr. ${fullName(d)}`,
            }))}
          />
        </FormRow>
        <Textarea
          name="description"
          label="Scope"
          rows={3}
          placeholder="Services, units and programs run by this department..."
          value={form.values.description}
          onChange={(e) => form.setValue("description", e.target.value)}
          error={form.errors.description}
        />
        <Switch
          checked={form.values.isActive}
          onCheckedChange={(v) => form.setValue("isActive", v)}
          label={form.values.isActive ? "Active" : "Inactive"}
          description="Turn off to mark this department inactive."
        />
      </form>
    </Dialog>
  );
}
