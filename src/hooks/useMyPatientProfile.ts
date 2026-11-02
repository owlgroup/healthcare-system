import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { decryptRow } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";
import { mapPatientPortalRow, type PatientPortalDetail } from "@/types/patient-portal";

async function fetchMyPatientProfile(userId: string): Promise<PatientPortalDetail | null> {
  const { data: row, error } = await supabase
    .from("patient")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  try {
    const decrypted = await decryptRow(row as Record<string, unknown>, "patient");
    return mapPatientPortalRow(decrypted);
  } catch {
    return mapPatientPortalRow(row as Record<string, unknown>);
  }
}

export function useMyPatientProfile() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["patient", "my-profile", userId],
    queryFn: () => fetchMyPatientProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/** Có bản ghi `patient` trong DB (không phụ thuộc submitted_at). */
export function hasPatientRecord(profile: PatientPortalDetail | null | undefined): profile is PatientPortalDetail {
  return profile != null && Boolean(profile.id);
}
