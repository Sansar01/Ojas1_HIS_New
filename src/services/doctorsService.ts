// services/doctorsService.ts  (ya jahan API calls rakhti ho)
import { request } from "@/services/apiClient";
import type { Doctor, ScheduleDay } from "@/types";

export function mapAvailabilityToUi(availability: any[] = []): ScheduleDay[] {
  const safeList = Array.isArray(availability) ? availability : [];
  const availMap = new Map(safeList.map((a: any) => [Number(a.dayOfWeek), a]));

  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const item = availMap.get(day);
    return {
      day,
      enabled: item ? Boolean(item.isActive) : false,
      start: item?.startTime || "09:00",
      end: item?.endTime || "17:00",
      breakStartTime: item?.breakStartTime || "",
      breakEndTime: item?.breakEndTime || "",
    };
  });
}

export async function getDoctorById(doctorProfileId: string): Promise<Doctor> {
  const res: any = await request({
    url: `/api/opd/doctors/${doctorProfileId}`,
    method: "GET",
  });

  const profile = res?.data ?? res;
  if (!profile?.id) throw new Error("Doctor profile not found");

  const qualifications =
    typeof profile.qualifications === "string"
      ? profile.qualifications.split(",").map((q: string) => q.trim()).filter(Boolean)
      : Array.isArray(profile.qualifications)
        ? profile.qualifications
        : [];

  return {
    id: String(profile.id),
    userId: profile.hospitalUserId ?? null,
    hospitalUserId: profile.hospitalUserId ?? "",
    firstName: profile.firstName ?? "Doctor",
    lastName: profile.lastName ?? "",
    gender: profile.gender ?? "Male",
    dateOfBirth: profile.dateOfBirth ?? "1985-01-01",
    joinedAt: profile.createdAt ?? new Date().toISOString(),
    email: profile.email ?? "",
    mobile: profile.mobile ?? "",
    registrationNumber: profile.registrationNumber ?? "—",
    departmentId: profile.departmentId ?? "",
    specializationId: profile.specialization ?? "",
    consultationFee: Number(profile.consultationFee) || 0,
    slotDuration: Number(profile.slotDurationMins) || 15,
    bufferTime: Number(profile.bufferTimeMins) || 0,
    maxPatientsPerDay: Number(profile.maxPatientsPerDay) || 20,
    qualifications,
    experienceYears: Number(profile.experienceYears) || 0,
    rating: Number(profile.rating) || 0,
    mode: profile.mode ?? "In-clinic",
    status: profile.isActive ? "active" : "inactive",
    about: profile.about ?? "",
    schedule: mapAvailabilityToUi(profile.availability ?? []),
  } as Doctor;
}