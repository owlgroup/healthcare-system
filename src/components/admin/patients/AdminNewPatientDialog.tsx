import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/onboarding/UploadCard";
import {
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
import DocImageLightbox from "@/components/onboarding/DocImageLightbox";
import DuplicatePatientAlert from "@/components/common/DuplicatePatientAlert";
import { supabase } from "@/lib/supabase";
import { createAdminUser, listAdminRoles } from "@/lib/admin-api";
import { adminInsertPatientProfile, staffCreatePatientProfile } from "@/lib/admin-appointment-api";
import { checkPatientDuplicate, logDedupAudit, type DupCheckResult } from "@/lib/duplicate-check";
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
import { CCCD_REQUIRED_EMPTY, validateCccdRequired } from "@/lib/cccd-required";

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

const empty: FormData = {
  legalLastName: "", legalFirstName: "", dateOfBirth: "",
  gender: "", phoneNumber: "", email: "",
  idNumber: "", expirationDate: "", issuedDate: "",
  issuer: "", residentialAddress: "",
  provider: "", memberId: "", groupNumber: "",
  bhytName: "", bhytDob: "", bhytGender: "",
  bhytAddress: "", bhytKcb: "", bhytKcbCode: "",
  bhytValidFrom: "", bhytFiveYear: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (patient?: PatientSearchResult) => void;
  portal?: "admin" | "provider";
  /** When opened inside another Dialog — skip second backdrop */
  nested?: boolean;
}

const UPLOAD_CARD_COMPACT = "min-h-0 rounded-lg px-3 py-4";

export default function AdminNewPatientDialog({ open, onClose, onSuccess, portal = "admin", nested = false }: Props) {
  const [form, setForm] = useState<FormData>(empty);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [ocrFront, setOcrFront] = useState(false);
  const [ocrBack, setOcrBack] = useState(false);
  const [ocrBhyt, setOcrBhyt] = useState(false);
  const [ocrFrontQuality, setOcrFrontQuality] = useState<OcrQualityResult | null>(null);
  const [ocrBackQuality, setOcrBackQuality] = useState<OcrQualityResult | null>(null);
  const [ocrBhytQuality, setOcrBhytQuality] = useState<OcrQualityResult | null>(null);

  const focusFirstEmptyCccdField = () => {
    const fields = ["legalLastName", "legalFirstName", "dateOfBirth", "idNumber", "expirationDate", "issuedDate", "issuer", "residentialAddress", "phoneNumber"];
    for (const id of fields) {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && !el.value?.trim()) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el.focus(), 100);
        return;
      }
    }
    const first = document.getElementById("legalLastName");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => first?.focus(), 100);
  };

  const focusFirstEmptyBhytField = () => {
    const fields = ["provider", "memberId", "groupNumber", "bhytName", "bhytDob", "bhytKcbCode", "bhytKcb"];
    for (const id of fields) {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && !el.value?.trim()) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el.focus(), 100);
        return;
      }
    }
    const first = document.getElementById("provider");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => first?.focus(), 100);
  };
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [dupResult, setDupResult] = useState<DupCheckResult | null>(null);
  const [dupBypassed, setDupBypassed] = useState(false);

  const {
    result: cccdBhytResult,
    confirmed: cccdBhytConfirmed,
    blocksSubmit: cccdBhytBlocksSubmit,
    confirm: confirmCccdBhytMismatch,
  } = useCccdBhytMismatch({
    cccdName: joinCccdFullName(form.legalLastName, form.legalFirstName),
    cccdDob: form.dateOfBirth,
    bhytName: form.bhytName,
    bhytDob: form.bhytDob,
  });

  const set = (k: keyof FormData) => (v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const pickFile = (file: File | null, setter: (f: File | null) => void) => {
    if (!file) return;
    if (file.size > MAX_SIZE) { toast.error("File quá lớn (tối đa 10MB)"); return; }
    setter(file);
  };

  const handleClose = () => {
    setForm(empty); setErrors({});
    setDupResult(null); setDupBypassed(false);
    setIdFile(null); setIdBackFile(null); setCardFile(null);
    setOcrFrontQuality(null); setOcrBackQuality(null); setOcrBhytQuality(null);
    setLightbox(null);
    onClose();
  };

  const runOcr = async (type: "front" | "back" | "bhyt") => {
    const file = type === "front" ? idFile : type === "back" ? idBackFile : cardFile;
    if (!file) return;
    const setter = type === "front" ? setOcrFront : type === "back" ? setOcrBack : setOcrBhyt;
    const qualitySetter = type === "front" ? setOcrFrontQuality : type === "back" ? setOcrBackQuality : setOcrBhytQuality;
    setter(true);
    qualitySetter(null);
    try {
      if (type === "bhyt") {
        const json = await fetchOcrSingle(file, "bhyt", "front");
        const quality = checkBhytOcrQuality(json);
        qualitySetter(quality);

        if (json.parsed && typeof json.parsed === "object") {
          setForm(p => applyBhytParsedFillEmpty(p, json.parsed));
        }

        if (quality.isLowQuality) {
          toast.warning("Ảnh BHYT không đủ rõ", { description: quality.message });
        } else {
          toast.success("OCR BHYT hoàn tất");
        }
      } else {
        const json = await fetchOcrSingle(file, "cccd", "front");
        const quality = checkCccdOcrQuality(json);
        qualitySetter(quality);

        if (json.parsed && typeof json.parsed === "object") {
          setForm(p => applyCccdParsedFillEmpty(p, json.parsed));
        }

        if (quality.isLowQuality) {
          toast.warning("Ảnh không đủ rõ", { description: quality.message });
        } else {
          toast.success(`OCR CCCD ${type === "front" ? "mặt trước" : "mặt sau"} hoàn tất`);
        }
      }
    } catch (e) {
      toast.error("OCR thất bại", { description: e instanceof Error ? e.message : undefined });
      qualitySetter({
        isLowQuality: true,
        confidence: 0,
        filledFieldCount: 0,
        totalExpectedFields: type === "bhyt" ? 4 : 5,
        message: "OCR thất bại. Vui lòng chụp lại hoặc nhập thủ công.",
      });
    } finally {
      setter(false);
    }
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {
      ...validateCccdRequired(form),
    };
    if (!form.legalLastName.trim()) errs.legalLastName = CCCD_REQUIRED_EMPTY;
    if (!form.legalFirstName.trim()) errs.legalFirstName = CCCD_REQUIRED_EMPTY;
    if (!form.dateOfBirth.trim()) errs.dateOfBirth = CCCD_REQUIRED_EMPTY;
    if (!form.phoneNumber.trim()) errs.phoneNumber = CCCD_REQUIRED_EMPTY;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (bypassReason?: string) => {
    if (!validate()) { toast.error("Vui lòng điền đầy đủ các trường bắt buộc"); return; }
    if (cccdBhytBlocksSubmit) {
      toast.error("CCCD và thẻ BHYT không khớp. Vui lòng xác nhận hoặc tải lại giấy tờ.");
      return;
    }

    const fullName = `${form.legalLastName.trim()} ${form.legalFirstName.trim()}`;

    if (!dupBypassed) {
      const dup = await checkPatientDuplicate(supabase, {
        cccd: form.idNumber.trim() || undefined,
        phone: form.phoneNumber.trim() || undefined,
        name: fullName,
        dob: form.dateOfBirth.trim() || undefined,
      });

      if (dup.cccdMatchId) {
        setDupResult(dup);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await logDedupAudit(supabase, {
            checkerUserId: user.id,
            checkType: 'cccd',
            normalizedValue: form.idNumber.trim(),
            matchedPatientId: dup.cccdMatchId,
            result: 'blocked',
            context: 'admin_create',
          });
        }
        toast.error('Trùng số CCCD — không thể tạo hồ sơ mới.');
        return;
      }

      if (dup.phoneMatchId || dup.nameDobMatchId) {
        if (!bypassReason) {
          setDupResult(dup);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const checkType = dup.phoneMatchId ? 'phone' as const : 'name_dob' as const;
          await logDedupAudit(supabase, {
            checkerUserId: user.id,
            checkType,
            normalizedValue: checkType === 'phone' ? form.phoneNumber.trim() : fullName,
            matchedPatientId: dup.phoneMatchId ?? dup.nameDobMatchId,
            result: 'bypassed',
            context: 'admin_create',
            bypassReason,
          });
        }
        setDupBypassed(true);
      }
    }

    setSaving(true);
    try {
      const phone = form.phoneNumber.trim();

      let profileId: string;
      let userId: string | null = null;

      if (portal === "provider") {
        const idNumber = form.idNumber.trim();
        const orFilters: string[] = [];
        if (phone) orFilters.push(`phone_number.eq.${phone}`);
        if (idNumber) orFilters.push(`id_number.eq.${idNumber}`);

        if (orFilters.length > 0 && !dupBypassed) {
          const { data: existing } = await supabase
            .from("patient")
            .select("id, legal_last_name, legal_first_name, phone_number, id_number")
            .or(orFilters.join(","))
            .limit(1)
            .maybeSingle();

          if (existing) {
            const name = `${existing.legal_last_name ?? ""} ${existing.legal_first_name ?? ""}`.trim();
            const conflict = existing.phone_number === phone ? `SĐT ${phone}` : `CCCD ${existing.id_number}`;
            throw new Error(`Đã tồn tại hồ sơ bệnh nhân "${name}" với ${conflict}.`);
          }
        }

        // Doctors: create profile directly, no auth user required
        profileId = await staffCreatePatientProfile(
          form.legalFirstName.trim(),
          form.legalLastName.trim(),
          phone || null,
          form.dateOfBirth || null,
          idNumber || null,
        );
      } else {
        // Admin: create auth user first
        const { roles } = await listAdminRoles();
        const patientRole = roles.find(r => r.slug === "patient");
        if (!patientRole) throw new Error("Không tìm thấy role bệnh nhân.");

        const tempEmail = phone
          ? `patient_${phone.replace(/\D/g, "")}@walkin.internal`
          : `patient_${Date.now()}@walkin.internal`;

        const created = await createAdminUser({
          fullName: `${form.legalLastName.trim()} ${form.legalFirstName.trim()}`,
          email: form.email.trim() || tempEmail,
          phone: phone || undefined,
          roleId: patientRole.id,
        });
        userId = created.userId;

        profileId = await adminInsertPatientProfile(
          userId,
          form.legalFirstName.trim(),
          form.legalLastName.trim(),
          phone || null,
          form.dateOfBirth || null,
          form.idNumber.trim() || null,
        );
      }

      // 3. Upload documents if provided
      const ts = Date.now();
      const paths: {
        id_document_storage_path?: string;
        id_document_back_storage_path?: string;
        card_front_storage_path?: string;
      } = {};

      const storagePrefix = userId ?? profileId;
      if (idFile) {
        const path = `${storagePrefix}/id_front_${ts}_${sanitize(idFile.name)}`;
        const { error } = await supabase.storage.from("identity-documents").upload(path, idFile, { upsert: true, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        paths.id_document_storage_path = path;
      }
      if (idBackFile) {
        const path = `${storagePrefix}/id_back_${ts}_${sanitize(idBackFile.name)}`;
        const { error } = await supabase.storage.from("identity-documents").upload(path, idBackFile, { upsert: true, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        paths.id_document_back_storage_path = path;
      }
      if (cardFile) {
        const path = `${storagePrefix}/card_front_${ts}_${sanitize(cardFile.name)}`;
        const { error } = await supabase.storage.from("insurance-cards").upload(path, cardFile, { upsert: true, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        paths.card_front_storage_path = path;
      }

      // 4. Upsert full profile data
      const e2n = (v: string) => v.trim() || null;
      const { error: upsertErr } = await supabase.from("patient").upsert({
        id: profileId,
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
        status: "ACTIVE",
        ...paths,
      }, { onConflict: "id" });

      if (upsertErr) throw new Error(upsertErr.message);

      toast.success("Đã tạo hồ sơ bệnh nhân thành công");
      handleClose();
      onSuccess({
        profile_id: profileId,
        patient_id: userId ?? profileId,
        patient_name: fullName,
        phone_number: phone || null,
        id_number: form.idNumber.trim() || null,
        date_of_birth: form.dateOfBirth || null,
        submitted_at: new Date().toISOString(),
      });
    } catch (e) {
      toast.error("Tạo hồ sơ thất bại", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const ocrRunning = ocrFront || ocrBack || ocrBhyt;
  const hasAnyFile = Boolean(idFile || idBackFile || cardFile);
  const typedName = `${form.legalLastName} ${form.legalFirstName}`.trim().toUpperCase();
  const footerHint = recordFooterHint(errors, cccdBhytBlocksSubmit);

  return (
    <>
    <Dialog open={open} onOpenChange={v => {
      if (!v) {
        if (lightbox) {
          setLightbox(null);
          return;
        }
        if (!saving) handleClose();
      }
    }}>
      <DialogContent
        className={RECORD_DIALOG_CLASS}
        hideOverlay={nested}
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
          kicker="Tạo hồ sơ bệnh nhân mới"
          name={typedName || "Hồ sơ mới"}
          onClose={handleClose}
          closeDisabled={saving}
        />

        <RecordDialogBody
          aside={
            <>
              <UploadCard id="new-id-front" title="Tải ảnh lên" hint="CCCD — mặt trước (tùy chọn)"
                className={UPLOAD_CARD_COMPACT}
                file={idFile} onFileSelect={f => { setOcrFrontQuality(null); pickFile(f, setIdFile); }}
                onOcr={() => runOcr("front")} isOcrRunning={ocrFront} ocrQuality={ocrFrontQuality}
                onManualInput={focusFirstEmptyCccdField}
                onPreview={(url, label) => setLightbox({ url, label })} />
              <UploadCard id="new-id-back" title="Tải ảnh lên" hint="CCCD — mặt sau (tùy chọn)"
                className={UPLOAD_CARD_COMPACT}
                file={idBackFile} onFileSelect={f => { setOcrBackQuality(null); pickFile(f, setIdBackFile); }}
                onOcr={() => runOcr("back")} isOcrRunning={ocrBack} ocrQuality={ocrBackQuality}
                onManualInput={focusFirstEmptyCccdField}
                onPreview={(url, label) => setLightbox({ url, label })} />
              <UploadCard id="new-card" title="Tải ảnh lên" hint="Thẻ BHYT (tùy chọn)"
                className={UPLOAD_CARD_COMPACT}
                file={cardFile} onFileSelect={f => { setOcrBhytQuality(null); pickFile(f, setCardFile); }}
                onOcr={() => runOcr("bhyt")} isOcrRunning={ocrBhyt} ocrQuality={ocrBhytQuality}
                onManualInput={focusFirstEmptyBhytField}
                onPreview={(url, label) => setLightbox({ url, label })} />
              <Button type="button" className="w-full" disabled={ocrRunning || !hasAnyFile}
                onClick={() => void (async () => {
                  await runOcr("front");
                  await runOcr("back");
                  await runOcr("bhyt");
                })()}>
                <ScanLine className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {ocrRunning ? "Đang đọc OCR…" : "Quét OCR tất cả"}
              </Button>
            </>
          }
        >
          <RecordMismatchNotice
            result={cccdBhytResult}
            confirmed={cccdBhytConfirmed}
            onConfirm={confirmCccdBhytMismatch}
          />

          {dupResult && !dupBypassed && (
            <DuplicatePatientAlert
              result={dupResult}
              onBypass={(reason) => void handleSave(reason)}
              onCancel={() => setDupResult(null)}
            />
          )}

          <RecordSection title="Thông tin cá nhân">
            <F id="legalLastName" label="Họ" value={form.legalLastName} onChange={set("legalLastName")}
              placeholder="VD: Nguyễn" required error={errors.legalLastName} invalid={cccdBhytResult.nameMismatch} />
            <F id="legalFirstName" label="Tên" value={form.legalFirstName} onChange={set("legalFirstName")} span={2}
              placeholder="VD: Văn An" required error={errors.legalFirstName} invalid={cccdBhytResult.nameMismatch} />
            <F id="dateOfBirth" label="Ngày sinh" value={form.dateOfBirth} onChange={set("dateOfBirth")}
              type="date" required error={errors.dateOfBirth} invalid={cccdBhytResult.dobMismatch} />
            <RecordGenderSelect label="Giới tính" value={form.gender} onChange={set("gender")} />
            <F id="phoneNumber" label="Số điện thoại" value={form.phoneNumber} onChange={set("phoneNumber")}
              type="tel" placeholder="0912 345 678" required error={errors.phoneNumber} />
            <F id="email" label="Email" value={form.email} onChange={set("email")} span={3}
              type="email" placeholder="example@email.com" />
          </RecordSection>

          <RecordSection title="Căn cước công dân">
            <F id="idNumber" label="Số CCCD" value={form.idNumber} onChange={set("idNumber")}
              placeholder="12 chữ số" required error={errors.idNumber} />
            <F id="issuedDate" label="Ngày cấp" value={form.issuedDate} onChange={set("issuedDate")} type="date"
              required error={errors.issuedDate} />
            <F id="expirationDate" label="Ngày hết hạn" value={form.expirationDate} onChange={set("expirationDate")}
              type="date" required error={errors.expirationDate} />
            <F id="issuer" label="Nơi cấp" value={form.issuer} onChange={set("issuer")} span={3}
              placeholder="Cục cảnh sát QLHC về TTXH" multiline required error={errors.issuer} />
            <F id="residentialAddress" label="Địa chỉ thường trú" value={form.residentialAddress}
              onChange={set("residentialAddress")}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" span={3}
              required error={errors.residentialAddress} />
          </RecordSection>

          <RecordSection title="Bảo hiểm y tế" note="Không bắt buộc">
            <F id="memberId" label="Mã thẻ BHYT" value={form.memberId} onChange={set("memberId")}
              placeholder="DN 4 79 791 101 31" />
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

        <RecordDialogFooter
          hint={footerHint}
          left={<Button variant="outline" onClick={handleClose} disabled={saving}>Hủy</Button>}
        >
          <Button onClick={() => void handleSave()} disabled={saving || cccdBhytBlocksSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo hồ sơ
          </Button>
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
