import { useEffect, useState } from "react";
import { Eye, FileText, Loader2, ScanLine, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getPatientRecordById } from "@/lib/patient-records";
import { joinCccdFullName } from "@/lib/cccd-bhyt-cross-validate";
import { useCccdBhytMismatch } from "@/hooks/useCccdBhytMismatch";
import {
  fetchOcrSingle,
  applyBhytParsedFillEmpty,
  applyCccdParsedFillEmpty,
  checkCccdOcrQuality,
  checkBhytOcrQuality,
  type OcrQualityResult,
} from "@/lib/cccd-ocr";
import { validateCccdRequired } from "@/lib/cccd-required";
import PatientRecordReviewActions from "@/components/patient-records/PatientRecordReviewActions";
import DocImageLightbox from "@/components/onboarding/DocImageLightbox";
import {
  DocSlotLabel,
  RECORD_DIALOG_CLASS,
  RecordDialogBody,
  RecordDialogFooter,
  RecordDialogHeader,
  RecordField as F,
  RecordGenderSelect,
  RecordMismatchNotice,
  RecordSection,
  recordFooterHint,
} from "@/components/admin/patients/PatientRecordFormLayout";

const MAX_SIZE = 10 * 1024 * 1024;

function sanitize(name: string) {
  return name.trim().replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

type FormData = {
  legalLastName: string; legalFirstName: string; dateOfBirth: string;
  gender: string; phoneNumber: string; email: string;
  idNumber: string; expirationDate: string; issuedDate: string;
  issuer: string; residentialAddress: string;
  provider: string; memberId: string; groupNumber: string;
  bhytName: string; bhytDob: string; bhytGender: string;
  bhytAddress: string; bhytKcb: string; bhytKcbCode: string;
  bhytValidFrom: string; bhytFiveYear: string;
};

function toForm(p: PatientPortalDetail): FormData {
  return {
    legalLastName: p.legal_last_name ?? "",
    legalFirstName: p.legal_first_name ?? "",
    dateOfBirth: p.date_of_birth ?? "",
    gender: p.preferred_pronouns ?? "",
    phoneNumber: p.phone_number ?? "",
    email: p.email_address ?? "",
    idNumber: p.id_number ?? "",
    expirationDate: p.id_expiration_date ?? "",
    issuedDate: p.id_issued_date ?? "",
    issuer: p.id_issuer ?? "",
    residentialAddress: p.residential_address ?? "",
    provider: p.insurance_provider ?? "",
    memberId: p.member_id ?? "",
    groupNumber: p.group_number ?? "",
    bhytName: p.bhyt_name ?? "",
    bhytDob: p.bhyt_dob ?? "",
    bhytGender: p.bhyt_gender ?? "",
    bhytAddress: p.bhyt_address ?? "",
    bhytKcb: p.bhyt_kcb ?? "",
    bhytKcbCode: p.bhyt_kcb_code ?? "",
    bhytValidFrom: p.bhyt_valid_from ?? "",
    bhytFiveYear: p.bhyt_five_year ?? "",
  };
}

interface Props {
  profileId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  canReview?: boolean;
}

function ImageSlot({
  inputId, label, existingUrl, storagePath, newFile, onFileSelect, onOcr, ocrRunning, ocrDone, onPreview,
}: {
  inputId: string; label: string;
  existingUrl: string | null; storagePath: string | null;
  newFile: File | null; onFileSelect: (f: File | null) => void;
  onOcr?: () => void; ocrRunning?: boolean; ocrDone?: boolean;
  onPreview?: (url: string, label: string) => void;
}) {
  const isPdf = (storagePath ?? "").toLowerCase().endsWith(".pdf");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!newFile?.type.startsWith("image/")) { setPreview(""); return; }
    const url = URL.createObjectURL(newFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [newFile]);

  const displayUrl = preview || (!newFile ? existingUrl : null);
  const canPreviewImage = Boolean(displayUrl) && !(isPdf && !newFile);

  return (
    <div>
      <DocSlotLabel label={label} done={newFile ? Boolean(ocrDone) : undefined} />
      <div className="relative h-[104px] overflow-hidden rounded-lg border bg-muted/30">
        {displayUrl ? (
          isPdf && !newFile ? (
            <a href={displayUrl} target="_blank" rel="noopener noreferrer"
              className="flex h-full items-center justify-center gap-2 text-sm text-primary hover:underline">
              <FileText className="h-5 w-5" />PDF
            </a>
          ) : (
            <img src={displayUrl} alt={label} className="h-full w-full object-cover" />
          )
        ) : (
          <label htmlFor={inputId}
            className="flex h-full cursor-pointer flex-col items-center justify-center gap-0.5 border-dashed bg-[#FFFAFB] text-center transition-colors hover:bg-[#FFF2F5]">
            <span className="flex items-center gap-1 text-[12.5px] font-semibold text-primary">
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />Tải ảnh lên
            </span>
            <span className="text-[11px] text-muted-foreground">JPG, PNG, PDF · tối đa 10MB</span>
          </label>
        )}

        {onOcr && (newFile || existingUrl) && (
          <button type="button" onClick={onOcr} disabled={ocrRunning}
            className="absolute right-1.5 top-1.5 flex cursor-pointer items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-primary shadow-sm hover:bg-white disabled:opacity-50">
            <ScanLine className="h-3 w-3" aria-hidden="true" />
            {ocrRunning ? "OCR…" : "OCR"}
          </button>
        )}

        {canPreviewImage ? (
          <button
            type="button"
            onClick={() => onPreview?.(displayUrl!, label)}
            aria-label={`Xem ảnh ${label}`}
            className="absolute bottom-1.5 left-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/90 text-foreground shadow-sm hover:bg-white"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}

        {displayUrl ? (
          <label htmlFor={inputId}
            className="absolute bottom-1.5 right-1.5 flex cursor-pointer items-center gap-1 rounded-md border bg-white/95 px-2 py-0.5 text-[11.5px] font-medium text-foreground shadow-sm hover:bg-white">
            <UploadCloud className="h-3 w-3" aria-hidden="true" />
            Thay ảnh
          </label>
        ) : null}
        <input id={inputId} type="file" accept=".png,.jpg,.jpeg,.pdf"
          className="sr-only"
          onChange={e => onFileSelect(e.target.files?.[0] ?? null)} />
      </div>

      {newFile && (
        <p className="mt-1 truncate text-[11px] font-medium text-primary">
          ✓ {newFile.name}
        </p>
      )}
    </div>
  );
}

export default function AdminEditPatientDialog({ profileId, open, onClose, onSuccess, canReview = false }: Props) {
  const [profile, setProfile] = useState<PatientPortalDetail | null>(null);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormData | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [ocrFront, setOcrFront] = useState(false);
  const [ocrBack, setOcrBack] = useState(false);
  const [ocrBhyt, setOcrBhyt] = useState(false);
  const [ocrDone, setOcrDone] = useState<{ front?: boolean; back?: boolean; bhyt?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const {
    result: cccdBhytResult,
    confirmed: cccdBhytConfirmed,
    blocksSubmit: cccdBhytBlocksSubmit,
    confirm: confirmCccdBhytMismatch,
  } = useCccdBhytMismatch({
    cccdName: joinCccdFullName(form?.legalLastName ?? "", form?.legalFirstName ?? ""),
    cccdDob: form?.dateOfBirth ?? "",
    bhytName: form?.bhytName ?? "",
    bhytDob: form?.bhytDob ?? "",
  });

  // Load profile + signed URLs when opened
  useEffect(() => {
    if (!open || !profileId) return;
    setLoading(true);
    setIdFile(null); setIdBackFile(null); setCardFile(null);
    setOcrDone({});
    setLightbox(null);
    setErrors({});

    getPatientRecordById(supabase, profileId).then(async ({ record, error }) => {
      if (error || !record) { setLoading(false); return; }
      setProfile(record);
      setForm(toForm(record));

      const [a, b, c] = await Promise.all([
        record.id_document_storage_path
          ? supabase.storage.from("identity-documents").createSignedUrl(record.id_document_storage_path, 3600)
          : null,
        record.id_document_back_storage_path
          ? supabase.storage.from("identity-documents").createSignedUrl(record.id_document_back_storage_path, 3600)
          : null,
        record.card_front_storage_path
          ? supabase.storage.from("insurance-cards").createSignedUrl(record.card_front_storage_path, 3600)
          : null,
      ]);
      setIdUrl(a?.data?.signedUrl ?? null);
      setIdBackUrl(b?.data?.signedUrl ?? null);
      setCardUrl(c?.data?.signedUrl ?? null);
      setLoading(false);
    });
  }, [open, profileId]);

  const set = (k: keyof FormData) => (v: string) => {
    setForm(p => p ? { ...p, [k]: v } : p);
    setErrors(p => { if (!p[k]) return p; const n = { ...p }; delete n[k]; return n; });
  };

  const runOcr = async (type: "front" | "back" | "bhyt") => {
    const file = type === "front" ? idFile : type === "back" ? idBackFile : cardFile;
    if (!file) { toast.info("Tải ảnh mới lên để chạy OCR"); return; }
    const setter = type === "front" ? setOcrFront : type === "back" ? setOcrBack : setOcrBhyt;
    setter(true);
    try {
      if (type === "bhyt") {
        const json = await fetchOcrSingle(file, "bhyt", "front");
        const quality = checkBhytOcrQuality(json);

        if (json.parsed && typeof json.parsed === "object") {
          setForm(p => p ? applyBhytParsedFillEmpty(p, json.parsed) : p);
        }

        if (quality.isLowQuality) {
          toast.warning("Ảnh BHYT không đủ rõ", { description: quality.message });
        } else {
          setOcrDone(p => ({ ...p, bhyt: true }));
          toast.success("OCR BHYT hoàn tất");
        }
      } else {
        const json = await fetchOcrSingle(file, "cccd", "front");
        const quality = checkCccdOcrQuality(json);

        if (json.parsed && typeof json.parsed === "object") {
          setForm(p => p ? applyCccdParsedFillEmpty(p, json.parsed) : p);
        }

        if (quality.isLowQuality) {
          toast.warning("Ảnh không đủ rõ", { description: quality.message });
        } else {
          setOcrDone(p => ({ ...p, [type]: true }));
          toast.success(`OCR CCCD ${type === "front" ? "mặt trước" : "mặt sau"} hoàn tất`);
        }
      }
    } catch (e) {
      toast.error("OCR thất bại", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setter(false);
    }
  };

  const handleSave = async () => {
    if (!form || !profile) return;
    const cccdErrs = validateCccdRequired(form);
    setErrors(cccdErrs);
    if (Object.keys(cccdErrs).length > 0) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }
    if (cccdBhytBlocksSubmit) {
      toast.error("CCCD và thẻ BHYT không khớp. Vui lòng xác nhận hoặc tải lại giấy tờ.");
      return;
    }
    setSaving(true);
    try {
      const userId = profile.user_id;
      const ts = Date.now();
      const paths: {
        id_document_storage_path?: string;
        id_document_back_storage_path?: string;
        card_front_storage_path?: string;
      } = {};

      const upload = async (file: File, bucket: string, key: string) => {
        const path = `${userId}/${key}_${ts}_${sanitize(file.name)}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        return path;
      };

      if (idFile) paths.id_document_storage_path = await upload(idFile, "identity-documents", "id_front");
      if (idBackFile) paths.id_document_back_storage_path = await upload(idBackFile, "identity-documents", "id_back");
      if (cardFile) paths.card_front_storage_path = await upload(cardFile, "insurance-cards", "card_front");

      const e2n = (v: string) => v.trim() || null;
      const { error } = await supabase.from("patient").upsert({
        id: profile.id,
        user_id: userId,
        legal_first_name: e2n(form.legalFirstName),
        legal_last_name: e2n(form.legalLastName),
        date_of_birth: e2n(form.dateOfBirth),
        phone_number: e2n(form.phoneNumber),
        email_address: e2n(form.email),
        preferred_pronouns: e2n(form.gender),
        id_number: e2n(form.idNumber),
        id_expiration_date: e2n(form.expirationDate),
        id_issued_date: e2n(form.issuedDate),
        id_issuer: e2n(form.issuer),
        residential_address: e2n(form.residentialAddress),
        insurance_provider: e2n(form.provider),
        member_id: e2n(form.memberId),
        group_number: e2n(form.groupNumber),
        bhyt_name: e2n(form.bhytName),
        bhyt_dob: e2n(form.bhytDob),
        bhyt_gender: e2n(form.bhytGender),
        bhyt_address: e2n(form.bhytAddress),
        bhyt_kcb: e2n(form.bhytKcb),
        bhyt_kcb_code: e2n(form.bhytKcbCode),
        bhyt_valid_from: e2n(form.bhytValidFrom),
        bhyt_five_year: e2n(form.bhytFiveYear),
        submitted_at: new Date().toISOString(),
        consent_accepted: true,
        ...paths,
      }, { onConflict: "id" });

      if (error) throw new Error(error.message);
      toast.success("Đã cập nhật hồ sơ bệnh nhân");
      onSuccess();
    } catch (e) {
      toast.error("Lưu thất bại", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const pickFile = (setter: (f: File | null) => void, key: "front" | "back" | "bhyt") => (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE) { toast.error("File quá lớn"); return; }
    setter(f);
    setOcrDone(p => ({ ...p, [key]: false }));
  };
  const ocrRunning = ocrFront || ocrBack || ocrBhyt;
  const hasNewFile = Boolean(idFile || idBackFile || cardFile);
  const footerHint = recordFooterHint(errors, cccdBhytBlocksSubmit);
  const headerName = form
    ? `${form.legalLastName} ${form.legalFirstName}`.trim().toUpperCase() || profile?.full_name || "—"
    : profile?.full_name ?? "Hồ sơ bệnh nhân";
  const headerMeta = profile
    ? `ID ${profile.id_number || `QC-${profile.id.slice(0, 8).toUpperCase()}`} · DOB ${profile.date_of_birth ?? "—"}`
    : undefined;

  return (
    <>
    <Dialog open={open} onOpenChange={v => {
      if (!v) {
        if (lightbox) {
          setLightbox(null);
          return;
        }
        if (!saving) onClose();
      }
    }}>
      <DialogContent
        className={RECORD_DIALOG_CLASS}
        onPointerDownOutside={(e) => { if (lightbox) e.preventDefault(); }}
        onFocusOutside={(e) => { if (lightbox) e.preventDefault(); }}
        onInteractOutside={(e) => { if (lightbox) e.preventDefault(); }}
        onEscapeKeyDown={(e) => {
          if (lightbox) {
            e.preventDefault();
            setLightbox(null);
          }
        }}
      >
        <RecordDialogHeader
          kicker="Chỉnh sửa hồ sơ bệnh nhân"
          name={headerName}
          meta={headerMeta}
          status={profile?.status}
          onClose={onClose}
          closeDisabled={saving}
        />

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải hồ sơ…
          </div>
        ) : !form ? (
          <p className="flex-1 py-8 text-center text-sm text-muted-foreground">Không tìm thấy hồ sơ.</p>
        ) : (
          <RecordDialogBody
            aside={
              <>
                <ImageSlot inputId="edit-id-front" label="CCCD mặt trước"
                  existingUrl={idUrl} storagePath={profile?.id_document_storage_path ?? null}
                  newFile={idFile} onFileSelect={pickFile(setIdFile, "front")}
                  onOcr={() => runOcr("front")} ocrRunning={ocrFront} ocrDone={ocrDone.front}
                  onPreview={(url, label) => setLightbox({ url, label })} />
                <ImageSlot inputId="edit-id-back" label="CCCD mặt sau"
                  existingUrl={idBackUrl} storagePath={profile?.id_document_back_storage_path ?? null}
                  newFile={idBackFile} onFileSelect={pickFile(setIdBackFile, "back")}
                  onOcr={() => runOcr("back")} ocrRunning={ocrBack} ocrDone={ocrDone.back}
                  onPreview={(url, label) => setLightbox({ url, label })} />
                <ImageSlot inputId="edit-card" label="Thẻ BHYT"
                  existingUrl={cardUrl} storagePath={profile?.card_front_storage_path ?? null}
                  newFile={cardFile} onFileSelect={pickFile(setCardFile, "bhyt")}
                  onOcr={() => runOcr("bhyt")} ocrRunning={ocrBhyt} ocrDone={ocrDone.bhyt}
                  onPreview={(url, label) => setLightbox({ url, label })} />
                <Button type="button" className="w-full" disabled={ocrRunning || !hasNewFile}
                  title={hasNewFile ? undefined : "Tải ảnh mới lên để chạy OCR"}
                  onClick={() => void (async () => {
                    if (idFile) await runOcr("front");
                    if (idBackFile) await runOcr("back");
                    if (cardFile) await runOcr("bhyt");
                  })()}>
                  <ScanLine className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {ocrRunning ? "Đang đọc OCR…" : "Quét OCR ảnh mới"}
                </Button>
              </>
            }
          >
            <RecordMismatchNotice
              result={cccdBhytResult}
              confirmed={cccdBhytConfirmed}
              onConfirm={confirmCccdBhytMismatch}
            />

            <RecordSection title="Thông tin cá nhân">
              <F id="legalLastName" label="Họ" value={form.legalLastName} onChange={set("legalLastName")}
                invalid={cccdBhytResult.nameMismatch} />
              <F id="legalFirstName" label="Tên" value={form.legalFirstName} onChange={set("legalFirstName")} span={2}
                invalid={cccdBhytResult.nameMismatch} />
              <F id="dateOfBirth" label="Ngày sinh" value={form.dateOfBirth} onChange={set("dateOfBirth")} type="date"
                invalid={cccdBhytResult.dobMismatch} />
              <RecordGenderSelect label="Giới tính" value={form.gender} onChange={set("gender")} />
              <F id="phoneNumber" label="Số điện thoại" value={form.phoneNumber} onChange={set("phoneNumber")} type="tel" />
              <F id="email" label="Email" value={form.email} onChange={set("email")} type="email" span={3} />
            </RecordSection>

            <RecordSection title="Căn cước công dân">
              <F id="idNumber" label="Số CCCD" value={form.idNumber} onChange={set("idNumber")} placeholder="12 chữ số"
                required error={errors.idNumber} />
              <F id="issuedDate" label="Ngày cấp" value={form.issuedDate} onChange={set("issuedDate")} type="date"
                required error={errors.issuedDate} />
              <F id="expirationDate" label="Ngày hết hạn" value={form.expirationDate} onChange={set("expirationDate")} type="date"
                required error={errors.expirationDate} />
              <F id="issuer" label="Nơi cấp" value={form.issuer} onChange={set("issuer")} multiline span={3}
                required error={errors.issuer} />
              <F id="residentialAddress" label="Địa chỉ thường trú" value={form.residentialAddress} onChange={set("residentialAddress")} span={3}
                required error={errors.residentialAddress} />
            </RecordSection>

            <RecordSection title="Bảo hiểm y tế" note="Không bắt buộc">
              <F id="memberId" label="Mã thẻ BHYT" value={form.memberId} onChange={set("memberId")} />
              <F id="groupNumber" label="Mã nhóm" value={form.groupNumber} onChange={set("groupNumber")} />
              <F id="bhytKcbCode" label="Mã KCB" value={form.bhytKcbCode} onChange={set("bhytKcbCode")} />
              <F id="bhytName" label="Họ tên trên thẻ" value={form.bhytName} onChange={set("bhytName")}
                invalid={cccdBhytResult.nameMismatch} />
              <F id="bhytDob" label="Ngày sinh trên thẻ" value={form.bhytDob} onChange={set("bhytDob")} type="date"
                invalid={cccdBhytResult.dobMismatch} />
              <RecordGenderSelect label="Giới tính trên thẻ" value={form.bhytGender} onChange={set("bhytGender")} />
              <F id="provider" label="Nhà cung cấp" value={form.provider} onChange={set("provider")} span={3} />
              <F id="bhytKcb" label="Nơi đăng ký KCB" value={form.bhytKcb} onChange={set("bhytKcb")} span={3} />
              <F id="bhytAddress" label="Địa chỉ / đơn vị" value={form.bhytAddress} onChange={set("bhytAddress")} span={3} />
              <F id="bhytValidFrom" label="Hiệu lực từ" value={form.bhytValidFrom} onChange={set("bhytValidFrom")} type="date" />
              <F id="bhytFiveYear" label="Đủ 5 năm liên tục từ" value={form.bhytFiveYear} onChange={set("bhytFiveYear")} type="date" />
            </RecordSection>
          </RecordDialogBody>
        )}

        <RecordDialogFooter
          hint={footerHint}
          left={<Button variant="outline" onClick={onClose} disabled={saving}>Hủy</Button>}
        >
          <>
            {profile ? (
              <PatientRecordReviewActions
                patientId={profile.id}
                status={profile.status}
                canReview={canReview}
                disabled={saving}
                onSuccess={() => {
                  onSuccess();
                  if (!profileId) return;
                  getPatientRecordById(supabase, profileId).then(({ record }) => {
                    if (record) setProfile(record);
                  });
                }}
              />
            ) : null}
            {form && (
              <Button onClick={() => void handleSave()} disabled={saving || loading || cccdBhytBlocksSubmit}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            )}
          </>
        </RecordDialogFooter>
      </DialogContent>
    </Dialog>
    {lightbox ? (
      <DocImageLightbox
        url={lightbox.url}
        label={lightbox.label}
        onClose={() => setLightbox(null)}
      />
    ) : null}
    </>
  );
}
