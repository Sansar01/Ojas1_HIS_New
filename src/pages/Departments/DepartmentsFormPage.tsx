import { useEffect, useState } from "react";
import { FormRow } from "@/components/common";
import { Input, Select, Switch, Textarea } from "@/components/ui/fields";
import { Dialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { departmentService } from "@/pages/Departments/department.service";
import { useAppDispatch } from "@/store/hooks";
import { doctorService } from "@/pages/doctors/doctor.service";
import { toast } from "@/store/slices/uiSlice";
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
  // head-of-department dropdown — loaded by this dialog, from its own service
  const [doctors, setDoctors] = useState<any[]>([]);

  // head-doctor options
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await doctorService.fetchDoctors();
        if (active && response.status === 200)
          setDoctors(response.data?.data ?? []);
      } catch (e: any) {
        if (active) {
          setDoctors([]);
          dispatch(toast.error("Could not load doctors", e?.message));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
    try {
      if (initial.id) {
        await departmentService.updateDepartment(initial.id, data);
        dispatch(toast.success("Department updated"));
      } else {
        await departmentService.createDepartment(data);
        dispatch(toast.success("Department created"));
      }
    } catch (e: any) {
      dispatch(
        toast.error(
          initial.id ? "Update failed" : "Creation failed",
          e?.message,
        ),
      );
      return;
    }
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
