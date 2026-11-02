import { useState } from "react";
import { Loader2, ScanLine, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UploadCard from "@/components/onboarding/UploadCard";
import CccdBhytMismatchBanner from "@/components/onboarding/CccdBhytMismatchBanner";
import DocImageLightbox from "@/components/onboarding/DocImageLightbox";
import { supabase } from "@/lib/supabase";
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

const MAX_SIZE = 10 * 1024 * 1024;

function sanitize(name: string) {
  return name.trim().replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

type FormData = {
  idNumber: string; expirationDate: string; residentialAddress: string;
  issuedDate: string; issuer: string;
  legalFirstName: string; legalLastName: string; dateOfBirth: string;
  phoneNumber: string; email: string; pronouns: string;
  provider: string; memberId: string; groupNumber: string;
  bhytName: string; bhytDob: string; bhytGender: string;
  bhytAddress: string; bhytKcb: string; bhytKcbCode: string;
  bhytValidFrom: string; bhytFiveYear: string;
};

const empty: FormData = {
  idNumber: "", expirationDate: "", residentialAddress: "",
  issuedDate: "", issuer: "",
  legalFirstName: "", legalLastName: "", dateOfBirth: "",
  phoneNumber: "", email: "", pronouns: "",
  provider: "", memberId: "", groupNumber: "",
  bhytName: "", bhytDob: "", bhytGender: "",
  bhytAddress: "", bhytKcb: "", bhytKcbCode: "",
  bhytValidFrom: "", bhytFiveYear: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profileId: string;
  patientUserId: string;
  patientName?: string | null;
  /** When opened inside Sheet/Dialog — skip second backdrop */
  nested?: boolean;
}

const lc = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const fc = "min-h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30";
const fc_err = "border-destructive ring-1 ring-destructive/30";

function F({ id, label, value, onChange, type = "text", placeholder, col2, required, error, invalid, multiline }: {
  id?: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; col2?: boolean; required?: boolean; error?: string; invalid?: boolean;
  multiline?: boolean;
}) {
  const fieldClass = `${fc} ${error || invalid ? fc_err : ""}`;
  return (
    <div className={col2 ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className={lc}>{label}{required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}</label>
      {multiline ? (
        <textarea id={id} rows={3} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={`${fieldClass} py-2 overflow-y-auto resize-none`} />
      ) : (
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={fieldClass} />
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function AdminCreateProfileDialog({
  open, onClose, onSuccess, profileId, patientUserId, patientName, nested = false,
}: Props) {
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
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

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

  const focusFirstEmptyCccdField = () => {
    const fields = ["idNumber", "expirationDate", "residentialAddress", "issuedDate", "issuer"];
    for (const fid of fields) {
      const el = document.getElementById(fid) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && !el.value?.trim()) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el.focus(), 100);
        return;
      }
    }
    const first = document.getElementById("idNumber");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => first?.focus(), 100);
  };

  const focusFirstEmptyBhytField = () => {
    const fields = ["provider", "memberId", "groupNumber", "bhytName"];
    for (const fid of fields) {
      const el = document.getElementById(fid) as HTMLInputElement | HTMLTextAreaElement | null;
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

  const set = (k: keyof FormData) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const pickFile = (file: File | null, setter: (f: File | null) => void) => {
    if (!file) return;
    if (file.size > MAX_SIZE) { toast.error("File quá lớn (tối đa 10MB)"); return; }
    setter(file);
  };

  const handleClose = () => {
    setForm(empty);
    setErrors({});
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
          setForm(p => applyCccdParsedFillEmpty(p, json.parsed, "pronouns"));
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

  const handleSave = async () => {
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
      const ts = Date.now();
      const paths: { id_document_storage_path?: string; id_document_back_storage_path?: string; card_front_storage_path?: string } = {};

      if (idFile) {
        const path = `${patientUserId}/id_front_${ts}_${sanitize(idFile.name)}`;
        const { error } = await supabase.storage.from("identity-documents").upload(path, idFile, { upsert: true, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        paths.id_document_storage_path = path;
      }
      if (idBackFile) {
        const path = `${patientUserId}/id_back_${ts}_${sanitize(idBackFile.name)}`;
        const { error } = await supabase.storage.from("identity-documents").upload(path, idBackFile, { upsert: true, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        paths.id_document_back_storage_path = path;
      }
      if (cardFile) {
        const path = `${patientUserId}/card_front_${ts}_${sanitize(cardFile.name)}`;
        const { error } = await supabase.storage.from("insurance-cards").upload(path, cardFile, { upsert: true, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        paths.card_front_storage_path = path;
      }

      const e2n = (v: string) => v.trim() || null;

      const { error } = await supabase.from("patient").upsert({
        id: profileId,
        user_id: patientUserId,
        id_number: e2n(form.idNumber),
        id_expiration_date: e2n(form.expirationDate),
        residential_address: e2n(form.residentialAddress),
        id_issued_date: e2n(form.issuedDate),
        id_issuer: e2n(form.issuer),
        legal_first_name: e2n(form.legalFirstName),
        legal_last_name: e2n(form.legalLastName),
        date_of_birth: e2n(form.dateOfBirth),
        phone_number: e2n(form.phoneNumber),
        email_address: e2n(form.email),
        preferred_pronouns: e2n(form.pronouns),
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

      if (error) throw new Error(error.message);

      toast.success("Đã lưu hồ sơ bệnh nhân");
      handleClose();
      onSuccess();
    } catch (e) {
      toast.error("Lưu thất bại", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const ocrAllRunning = ocrFront || ocrBack || ocrBhyt;
  const hasAnyFile = Boolean(idFile || idBackFile || cardFile);

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
        className="max-h-[92vh] max-w-2xl overflow-y-auto"
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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="h-5 w-5 text-primary" />
            Tạo hồ sơ bệnh nhân{patientName ? ` — ${patientName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pb-2">
          {/* Upload section */}
          <section className="rounded-2xl border bg-card p-4">
            <h3 className="mb-1 text-sm font-semibold">Tải ảnh giấy tờ</h3>
            <p className="mb-4 text-xs text-muted-foreground">CCCD mặt trước, mặt sau và thẻ BHYT.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <UploadCard id="adm-id-front" title="Nhấn để tải lên" hint="CCCD — mặt trước"
                file={idFile} onFileSelect={f => { setOcrFrontQuality(null); pickFile(f, setIdFile); }}
                onOcr={() => runOcr("front")} isOcrRunning={ocrFront} ocrQuality={ocrFrontQuality}
                onManualInput={focusFirstEmptyCccdField}
                onPreview={(url, label) => setLightbox({ url, label })} />
              <UploadCard id="adm-id-back" title="Nhấn để tải lên" hint="CCCD — mặt sau"
                file={idBackFile} onFileSelect={f => { setOcrBackQuality(null); pickFile(f, setIdBackFile); }}
                onOcr={() => runOcr("back")} isOcrRunning={ocrBack} ocrQuality={ocrBackQuality}
                onManualInput={focusFirstEmptyCccdField}
                onPreview={(url, label) => setLightbox({ url, label })} />
              <UploadCard id="adm-card" title="Nhấn để tải lên" hint="Bảo hiểm y tế (BHYT)"
                file={cardFile} onFileSelect={f => { setOcrBhytQuality(null); pickFile(f, setCardFile); }}
                onOcr={() => runOcr("bhyt")} isOcrRunning={ocrBhyt} ocrQuality={ocrBhytQuality}
                onManualInput={focusFirstEmptyBhytField}
                onPreview={(url, label) => setLightbox({ url, label })} />
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="button" size="sm"
                disabled={ocrAllRunning || !hasAnyFile}
                onClick={() => void (async () => {
                  await runOcr("front");
                  await runOcr("back");
                  await runOcr("bhyt");
                })()}
              >
                <ScanLine className="mr-1.5 h-3.5 w-3.5" />
                {ocrAllRunning ? "Đang đọc OCR…" : "OCR tất cả"}
              </Button>
            </div>
          </section>

          {/* Identity */}
          <section className="rounded-2xl border bg-muted/30 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thông tin từ CCCD
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <F id="idNumber" label="Số CCCD" value={form.idNumber} onChange={set("idNumber")} placeholder="G-123-5678-9012"
                required error={errors.idNumber} />
              <F id="expirationDate" label="Ngày hết hạn" value={form.expirationDate} onChange={set("expirationDate")} type="date"
                required error={errors.expirationDate} />
              <F id="issuedDate" label="Ngày cấp" value={form.issuedDate} onChange={set("issuedDate")} type="date"
                required error={errors.issuedDate} />
              <F id="issuer" label="Nơi cấp" value={form.issuer} onChange={set("issuer")} placeholder="Cục cảnh sát QLHC về TTXH" multiline
                required error={errors.issuer} />
              <F id="residentialAddress" label="Địa chỉ thường trú" value={form.residentialAddress} onChange={set("residentialAddress")}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" col2
                required error={errors.residentialAddress} />
            </div>
          </section>

          {/* Personal */}
          <section className="rounded-2xl border bg-muted/30 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thông tin cá nhân
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <F id="legalLastName" label="Họ" value={form.legalLastName} onChange={set("legalLastName")}
                invalid={cccdBhytResult.nameMismatch} />
              <F id="legalFirstName" label="Tên" value={form.legalFirstName} onChange={set("legalFirstName")}
                invalid={cccdBhytResult.nameMismatch} />
              <F id="dateOfBirth" label="Ngày sinh" value={form.dateOfBirth} onChange={set("dateOfBirth")} type="date"
                invalid={cccdBhytResult.dobMismatch} />
              <F id="phoneNumber" label="Số điện thoại" value={form.phoneNumber} onChange={set("phoneNumber")} type="tel" placeholder="0912 345 678" />
              <F id="email" label="Email" value={form.email} onChange={set("email")} type="email" placeholder="example@email.com" />
              <div>
                <label className={lc}>Giới tính</label>
                <Select value={form.pronouns} onValueChange={set("pronouns")}>
                  <SelectTrigger className="min-h-10 w-full rounded-xl">
                    <SelectValue placeholder="Chọn giới tính" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nam">Nam</SelectItem>
                    <SelectItem value="Nữ">Nữ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Insurance */}
          <section className="rounded-2xl border bg-muted/30 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bảo hiểm (BHYT)
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <F id="provider" label="Nhà cung cấp" value={form.provider} onChange={set("provider")} col2 />
              <F id="memberId" label="Mã thành viên / BHYT" value={form.memberId} onChange={set("memberId")} placeholder="DN 4 79 791 101 31" />
              <F id="groupNumber" label="Mã nhóm" value={form.groupNumber} onChange={set("groupNumber")} />
              <F id="bhytName" label="Họ tên trên BHYT" value={form.bhytName} onChange={set("bhytName")}
                invalid={cccdBhytResult.nameMismatch} />
              <F id="bhytDob" label="Ngày sinh (BHYT)" value={form.bhytDob} onChange={set("bhytDob")} type="date"
                invalid={cccdBhytResult.dobMismatch} />
              <div>
                <label className={lc}>Giới tính</label>
                <Select value={form.bhytGender} onValueChange={set("bhytGender")}>
                  <SelectTrigger className="min-h-10 w-full rounded-xl">
                    <SelectValue placeholder="Chọn giới tính" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nam">Nam</SelectItem>
                    <SelectItem value="Nữ">Nữ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <F id="bhytKcbCode" label="Mã KCB" value={form.bhytKcbCode} onChange={set("bhytKcbCode")} />
              <F id="bhytKcb" label="Nơi đăng ký KCB" value={form.bhytKcb} onChange={set("bhytKcb")} />
              <F id="bhytAddress" label="Địa chỉ / đơn vị" value={form.bhytAddress} onChange={set("bhytAddress")} col2 />
              <F id="bhytValidFrom" label="Hiệu lực từ" value={form.bhytValidFrom} onChange={set("bhytValidFrom")} type="date" />
              <F id="bhytFiveYear" label="Ngày 5 năm liên tục" value={form.bhytFiveYear} onChange={set("bhytFiveYear")} type="date" />
            </div>
          </section>

          <CccdBhytMismatchBanner
            result={cccdBhytResult}
            confirmed={cccdBhytConfirmed}
            onConfirm={confirmCccdBhytMismatch}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-3">
          <Button variant="outline" onClick={handleClose} disabled={saving}>Hủy</Button>
          <Button onClick={() => void handleSave()} disabled={saving || cccdBhytBlocksSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu hồ sơ
          </Button>
        </div>
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
