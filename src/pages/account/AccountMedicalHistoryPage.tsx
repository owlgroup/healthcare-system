import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, ChevronDown, FileText, FileUser, Loader2, Pill, Scissors, Shield,
} from "lucide-react";
import { toast } from "sonner";
import HealthSection from "@/components/HealthSection";
import PatientProfileSheet from "@/components/patient/PatientProfileDialog";
import HealthItemRow from "@/components/patient/health-history/HealthItemRow";
import AddAllergyDialog from "@/components/patient/health-history/AddAllergyDialog";
import AddMedicationDialog from "@/components/patient/health-history/AddMedicationDialog";
import AddConditionDialog from "@/components/patient/health-history/AddConditionDialog";
import AddSurgeryDialog from "@/components/patient/health-history/AddSurgeryDialog";
import AddImmunizationDialog from "@/components/patient/health-history/AddImmunizationDialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import {
  fetchMyHealthHistory,
  removeAllergy,
  removeCondition,
  removeImmunization,
  removeMedication,
  removeSurgery,
} from "@/lib/patient-health-history-api";
import { cn } from "@/lib/utils";

const AccountMedicalHistoryPage = () => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [surgeryOpen, setSurgeryOpen] = useState(false);
  const [vaxOpen, setVaxOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const healthQueryKey = ["patient", "health-history", userId];

  const { data: hasProfile } = useQuery({
    queryKey: ["patient", "has-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient")
        .select("id")
        .eq("user_id", userId as string)
        .maybeSingle();
      return Boolean(data?.id);
    },
    enabled: Boolean(userId),
  });

  const { data: chart, isLoading, isError, error, refetch } = useQuery({
    queryKey: healthQueryKey,
    queryFn: fetchMyHealthHistory,
    enabled: Boolean(userId),
    retry: false,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: healthQueryKey });

  const handleDelete = async (type: string, id: string) => {
    setDeletingId(id);
    try {
      if (type === "allergy") await removeAllergy(id);
      else if (type === "med") await removeMedication(id);
      else if (type === "cond") await removeCondition(id);
      else if (type === "surgery") await removeSurgery(id);
      else await removeImmunization(id);
      toast.success("Đã xóa");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể xóa");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-foreground">Tiền sử bệnh (Lịch sử sức khỏe)</h2>

      <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-primary">
            Bệnh nhân mới? Hoàn thành thông tin cá nhân, giấy tờ và bảo hiểm để đẩy nhanh quá trình khám.
          </p>
          {hasProfile ? (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-card px-4 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <FileUser className="h-4 w-4" />
              Xem hồ sơ bệnh nhân
            </button>
          ) : (
            <Link
              to="/onboarding"
              className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Tạo hồ sơ
            </Link>
          )}
        </div>
      </div>

      <PatientProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />

      {isError && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p className="text-sm font-semibold text-destructive">Không tải được lịch sử sức khỏe</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Lỗi không xác định"}
          </p>
          <button type="button" onClick={() => void refetch()} className="mt-3 text-sm font-semibold text-primary hover:underline">
            Thử lại
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : isError ? null : (
        <div className="space-y-6">
          <HealthSection
            icon={AlertTriangle}
            iconColor="text-warning"
            title="Dị ứng"
            action="Thêm dị ứng mới"
            onActionClick={() => setAllergyOpen(true)}
          >
            <p className="mb-3 text-sm text-muted-foreground">Quản lý các dị ứng thuốc và môi trường của bạn.</p>
            {chart?.allergies.length === 0 && (
              <p className="mb-3 text-sm text-muted-foreground">Chưa có dị ứng nào.</p>
            )}
            {chart?.allergies.map((a) => (
              <HealthItemRow
                key={a.id}
                title={a.name}
                subtitle={[a.severity, a.reaction].filter(Boolean).join(" • ")}
                borderAccent
                deleting={deletingId === a.id}
                onDelete={() => void handleDelete("allergy", a.id)}
              />
            ))}
          </HealthSection>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <HealthSection icon={Pill} iconColor="text-primary" title="Thuốc đang dùng" action="Thêm mới" onActionClick={() => setMedOpen(true)}>
              {chart?.medications.length === 0 && <p className="mb-3 text-sm text-muted-foreground">Chưa có thuốc nào.</p>}
              {chart?.medications.map((m) => (
                <HealthItemRow
                  key={m.id}
                  title={m.name}
                  subtitle={[m.dose, m.frequency].filter(Boolean).join(" • ") || "—"}
                  deleting={deletingId === m.id}
                  onDelete={() => void handleDelete("med", m.id)}
                />
              ))}
            </HealthSection>

            <HealthSection icon={FileText} iconColor="text-primary" title="Bệnh lý" action="Thêm mới" onActionClick={() => setCondOpen(true)}>
              {chart?.diagnoses.length === 0 && <p className="mb-3 text-sm text-muted-foreground">Chưa có bệnh lý nào.</p>}
              {chart?.diagnoses.map((c) => (
                <HealthItemRow
                  key={c.id}
                  title={c.name}
                  subtitle={[c.diagnosed_year ? `Chẩn đoán: ${c.diagnosed_year}` : null, c.status].filter(Boolean).join(" • ")}
                  deleting={deletingId === c.id}
                  onDelete={() => void handleDelete("cond", c.id)}
                />
              ))}
            </HealthSection>
          </div>

          <div className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setExtraOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
            >
              Phẫu thuật & Tiêm chủng
              <ChevronDown className={cn("h-4 w-4 transition-transform", extraOpen && "rotate-180")} />
            </button>
            {extraOpen ? (
              <div className="grid grid-cols-1 gap-6 border-t p-4 md:grid-cols-2">
                <HealthSection icon={Scissors} iconColor="text-primary" title="Phẫu thuật" action="Thêm mới" onActionClick={() => setSurgeryOpen(true)}>
                  {chart?.surgeries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có lịch sử phẫu thuật.</p>
                  ) : (
                    chart.surgeries.map((s) => (
                      <HealthItemRow
                        key={s.id}
                        title={s.name}
                        subtitle={[s.year ? `Năm ${s.year}` : null, s.notes].filter(Boolean).join(" • ")}
                        deleting={deletingId === s.id}
                        onDelete={() => void handleDelete("surgery", s.id)}
                      />
                    ))
                  )}
                </HealthSection>

                <HealthSection icon={Shield} iconColor="text-success" title="Tiêm chủng">
                  {chart?.immunizations.length === 0 && <p className="mb-3 text-sm text-muted-foreground">Chưa có vaccine nào.</p>}
                  <div className="mb-3 space-y-3">
                    {chart?.immunizations.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{v.name}</p>
                          {v.date ? <p className="text-xs text-muted-foreground">{v.date}</p> : null}
                        </div>
                        <button type="button" className="text-xs text-muted-foreground hover:text-destructive" disabled={deletingId === v.id} onClick={() => void handleDelete("vax", v.id)}>
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setVaxOpen(true)} className="w-full rounded-lg border border-primary/20 py-2 text-sm font-medium text-primary hover:bg-accent">
                    Thêm vaccine
                  </button>
                </HealthSection>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <AddAllergyDialog open={allergyOpen} onOpenChange={setAllergyOpen} onSuccess={refresh} />
      <AddMedicationDialog open={medOpen} onOpenChange={setMedOpen} onSuccess={refresh} />
      <AddConditionDialog open={condOpen} onOpenChange={setCondOpen} onSuccess={refresh} />
      <AddSurgeryDialog open={surgeryOpen} onOpenChange={setSurgeryOpen} onSuccess={refresh} />
      <AddImmunizationDialog open={vaxOpen} onOpenChange={setVaxOpen} onSuccess={refresh} />
    </section>
  );
};

export default AccountMedicalHistoryPage;
