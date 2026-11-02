import { Eye, FileText, Loader2, UserRound } from "lucide-react";
import { useState } from "react";
import { formatPatientProfileStatus } from "@/config/ui-labels";
import type { PatientPortalDetail } from "@/types/patient-portal";
import PatientRecordReviewActions from "@/components/patient-records/PatientRecordReviewActions";
import DocImageLightbox from "@/components/onboarding/DocImageLightbox";

function formatDob(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function DocImage({
  url, label, storagePath, onPreview,
}: {
  url: string; label: string; storagePath?: string | null;
  onPreview?: (url: string, label: string) => void;
}) {
  const isPdf = (storagePath ?? "").toLowerCase().endsWith(".pdf");
  return (
    <div className="overflow-hidden rounded-lg border">
      <p className="bg-muted/30 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="relative">
        {isPdf ? (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex h-32 items-center justify-center gap-2 bg-muted/20 text-sm font-medium text-primary hover:underline">
            <FileText className="h-5 w-5" />Xem PDF
          </a>
        ) : (
          <img src={url} alt={label} className="h-32 w-full object-cover" />
        )}
        {!isPdf ? (
          <button
            type="button"
            onClick={() => onPreview?.(url, label)}
            aria-label={`Xem ảnh ${label}`}
            className="absolute bottom-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-foreground shadow hover:bg-white"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export type PatientDocImageUrls = {
  idFront?: string | null;
  idBack?: string | null;
  card?: string | null;
};

type PatientRecordDetailPanelProps = {
  profile: PatientPortalDetail | null;
  isLoading?: boolean;
  isError?: boolean;
  imageUrls?: PatientDocImageUrls;
  canReview?: boolean;
  onReviewed?: () => void;
};

const PatientRecordDetailPanel = ({
  profile,
  isLoading = false,
  isError = false,
  imageUrls,
  canReview = false,
  onReviewed,
}: PatientRecordDetailPanelProps) => {
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Đang tải chi tiết…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-8 text-sm text-destructive" role="alert">
        Không tải được hồ sơ. Kiểm tra quyền truy cập hoặc thử lại.
      </p>
    );
  }

  if (!profile) {
    return <p className="py-8 text-sm text-muted-foreground">Không tìm thấy hồ sơ.</p>;
  }

  const displayId =
    profile.id_number?.trim() || `QC-${profile.id.slice(0, 8).toUpperCase()}`;

  return (
    <>
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-foreground/20">
          <UserRound className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xl font-bold">{profile.full_name}</p>
          <p className="text-sm opacity-90">
            ID: {displayId} · DOB: {formatDob(profile.date_of_birth)}
          </p>
          {profile.preferred_pronouns ? (
            <p className="text-xs opacity-80">{profile.preferred_pronouns}</p>
          ) : null}
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Thông tin cá nhân</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Họ tên" value={profile.full_name} />
          <Field label="Ngày sinh" value={formatDob(profile.date_of_birth)} />
          <Field label="Email" value={profile.email_address ?? ""} />
          <Field label="Số điện thoại" value={profile.phone_number ?? ""} />
          <Field label="Đại từ" value={profile.preferred_pronouns ?? ""} />
          <Field
            label="Trạng thái"
            value={formatPatientProfileStatus(profile.status)}
          />
          {profile.status === "REJECTED" && profile.rejection_reason ? (
            <Field label="Lý do từ chối" value={profile.rejection_reason} />
          ) : null}
          <Field
            label="Đồng ý xử lý dữ liệu"
            value={profile.consent_accepted ? "Có" : "Chưa"}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Giấy tờ tùy thân</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Số CCCD/ID" value={profile.id_number ?? ""} />
          <Field label="Nơi cấp" value={profile.id_issuer ?? ""} />
          <Field label="Ngày cấp" value={formatDob(profile.id_issued_date)} />
          <Field label="Ngày hết hạn" value={formatDob(profile.id_expiration_date)} />
          <Field label="Địa chỉ" value={profile.residential_address ?? ""} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Bảo hiểm (BHYT)</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Nhà cung cấp" value={profile.insurance_provider ?? ""} />
          <Field label="Mã thành viên / BHYT" value={profile.member_id ?? ""} />
          <Field label="Mã nhóm" value={profile.group_number ?? ""} />
          <Field label="Họ tên trên BHYT" value={profile.bhyt_name ?? ""} />
          <Field label="Ngày sinh (BHYT)" value={formatDob(profile.bhyt_dob)} />
          <Field label="Giới tính" value={profile.bhyt_gender ?? ""} />
          <Field label="Mã KCB" value={profile.bhyt_kcb_code ?? ""} />
          <Field label="Nơi đăng ký KCB" value={profile.bhyt_kcb ?? ""} />
          <Field label="Địa chỉ / đơn vị" value={profile.bhyt_address ?? ""} />
          <Field label="Hiệu lực từ" value={formatDob(profile.bhyt_valid_from)} />
          <Field label="Ngày 5 năm" value={formatDob(profile.bhyt_five_year)} />
        </div>
      </section>

      {(imageUrls?.idFront || imageUrls?.idBack || imageUrls?.card) && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Ảnh giấy tờ</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {imageUrls.idFront && (
              <DocImage url={imageUrls.idFront} label="CCCD mặt trước" storagePath={profile.id_document_storage_path}
                onPreview={(url, label) => setLightbox({ url, label })} />
            )}
            {imageUrls.idBack && (
              <DocImage url={imageUrls.idBack} label="CCCD mặt sau" storagePath={profile.id_document_back_storage_path}
                onPreview={(url, label) => setLightbox({ url, label })} />
            )}
            {imageUrls.card && (
              <DocImage url={imageUrls.card} label="Thẻ BHYT" storagePath={profile.card_front_storage_path}
                onPreview={(url, label) => setLightbox({ url, label })} />
            )}
          </div>
        </section>
      )}

      {canReview ? (
        <PatientRecordReviewActions
          patientId={profile.id}
          status={profile.status}
          canReview={canReview}
          onSuccess={() => onReviewed?.()}
        />
      ) : null}
    </div>
    {lightbox ? (
      <DocImageLightbox
        url={lightbox.url}
        label={lightbox.label}
        onClose={() => setLightbox(null)}
      />
    ) : null}
    </>
  );
};

export default PatientRecordDetailPanel;
