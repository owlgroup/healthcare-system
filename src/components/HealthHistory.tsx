import { AlertTriangle, CheckCircle2, FileText, FileUser, Loader2, Pill, Scissors, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import HealthSection from "./HealthSection";
import ProfileSummary from "./ProfileSummary";
import PatientProfileDialog from "@/components/patient/PatientProfileDialog";
import HealthItemRow from "@/components/patient/health-history/HealthItemRow";
import AddAllergyDialog from "@/components/patient/health-history/AddAllergyDialog";
import AddMedicationDialog from "@/components/patient/health-history/AddMedicationDialog";
import AddConditionDialog from "@/components/patient/health-history/AddConditionDialog";
import AddSurgeryDialog from "@/components/patient/health-history/AddSurgeryDialog";
import AddImmunizationDialog from "@/components/patient/health-history/AddImmunizationDialog";
import EditProfileSummaryDialog from "@/components/patient/health-history/EditProfileSummaryDialog";
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
import { useState } from "react";

const HealthHistory = () => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [surgeryOpen, setSurgeryOpen] = useState(false);
  const [vaxOpen, setVaxOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
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
        .select("submitted_at")
        .eq("user_id", userId as string)
        .maybeSingle();
      return Boolean(data?.submitted_at);
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
    <main className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Lịch sử sức khỏe</h1>
        <p className="text-muted-foreground mb-8 text-sm md:text-base">
          Duy trì hồ sơ đầy đủ về lịch sử lâm sàng của bạn. Thông tin này giúp đội ngũ chăm sóc cung cấp hỗ trợ y tế chính xác và toàn diện nhất.
        </p>

        <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
          <p className="text-sm text-primary">
            Bệnh nhân mới? Hoàn thành thông tin cá nhân, giấy tờ và bảo hiểm để đẩy nhanh quá trình khám.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {hasProfile ? (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-card px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                <FileUser className="h-4 w-4" aria-hidden="true" />
                Xem hồ sơ bệnh nhân
              </button>
            ) : (
              <Link
                to="/onboarding"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Tạo hồ sơ bệnh án
              </Link>
            )}
          </div>
        </div>

        <PatientProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

        {isError && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
            <p className="text-sm font-semibold text-destructive">Không tải được lịch sử sức khỏe</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : "Lỗi không xác định"}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 text-sm font-semibold text-primary hover:underline"
            >
              Thử lại
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : isError ? null : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <HealthSection
                icon={AlertTriangle}
                iconColor="text-warning"
                title="Dị ứng"
                action="Thêm dị ứng mới"
                onActionClick={() => setAllergyOpen(true)}
              >
                <p className="text-sm text-muted-foreground mb-3">Quản lý các dị ứng thuốc và môi trường của bạn.</p>
                {chart?.allergies.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-3">Chưa có dị ứng nào.</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <HealthSection
                  icon={Pill}
                  iconColor="text-primary"
                  title="Thuốc đang dùng"
                  action="Thêm mới"
                  onActionClick={() => setMedOpen(true)}
                >
                  {chart?.medications.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-3">Chưa có thuốc nào.</p>
                  )}
                  {chart?.medications.map((m) => (
                    <div key={m.id} className="rounded-lg bg-muted/50 p-4 mb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            {[m.dose, m.frequency].filter(Boolean).join(" • ") || "—"}
                          </p>
                          {(m.pharmacy || m.refills_remaining != null) && (
                            <div className="flex flex-wrap gap-2">
                              {m.pharmacy && (
                                <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 bg-sky-100 text-sky-700">
                                  Nhà thuốc: {m.pharmacy}
                                </span>
                              )}
                              {m.refills_remaining != null && (
                                <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 bg-violet-100 text-violet-700">
                                  Còn lại: {m.refills_remaining} lần
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                          disabled={deletingId === m.id}
                          onClick={() => void handleDelete("med", m.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </HealthSection>

                <HealthSection
                  icon={FileText}
                  iconColor="text-primary"
                  title="Bệnh lý"
                  action="Thêm mới"
                  onActionClick={() => setCondOpen(true)}
                >
                  {chart?.diagnoses.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-3">Chưa có bệnh lý nào.</p>
                  )}
                  {chart?.diagnoses.map((c) => (
                    <HealthItemRow
                      key={c.id}
                      title={c.name}
                      subtitle={[
                        c.diagnosed_year ? `Chẩn đoán: ${c.diagnosed_year}` : null,
                        c.status,
                      ].filter(Boolean).join(" • ")}
                      deleting={deletingId === c.id}
                      onDelete={() => void handleDelete("cond", c.id)}
                    />
                  ))}
                </HealthSection>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <HealthSection
                  icon={Scissors}
                  iconColor="text-primary"
                  title="Phẫu thuật"
                  action="Thêm mới"
                  onActionClick={() => setSurgeryOpen(true)}
                >
                  {chart?.surgeries.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-3">Chưa có lịch sử phẫu thuật.</p>
                    </div>
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
                  {chart?.immunizations.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-3">Chưa có vaccine nào.</p>
                  )}
                  <div className="space-y-3 mb-3">
                    {chart?.immunizations.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{v.name}</p>
                          {v.date && <p className="text-xs text-muted-foreground">{v.date}</p>}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          disabled={deletingId === v.id}
                          onClick={() => void handleDelete("vax", v.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVaxOpen(true)}
                    className="w-full rounded-lg border border-primary/20 py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
                  >
                    Thêm vaccine
                  </button>
                </HealthSection>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <ProfileSummary chart={chart ?? null} onEdit={() => setSummaryOpen(true)} />
              </div>
            </div>
          </div>
        )}

        <AddAllergyDialog open={allergyOpen} onOpenChange={setAllergyOpen} onSuccess={refresh} />
        <AddMedicationDialog open={medOpen} onOpenChange={setMedOpen} onSuccess={refresh} />
        <AddConditionDialog open={condOpen} onOpenChange={setCondOpen} onSuccess={refresh} />
        <AddSurgeryDialog open={surgeryOpen} onOpenChange={setSurgeryOpen} onSuccess={refresh} />
        <AddImmunizationDialog open={vaxOpen} onOpenChange={setVaxOpen} onSuccess={refresh} />
        <EditProfileSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          onSuccess={refresh}
          chart={chart ?? null}
        />
      </div>
    </main>
  );
};

export default HealthHistory;
