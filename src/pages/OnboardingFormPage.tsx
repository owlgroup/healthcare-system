import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import CccdBhytMismatchBanner from "@/components/onboarding/CccdBhytMismatchBanner";
import OnboardingActions from "@/components/onboarding/OnboardingActions";
import UploadCard from "@/components/onboarding/UploadCard";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useCccdBhytMismatch } from "@/hooks/useCccdBhytMismatch";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { joinCccdFullName } from "@/lib/cccd-bhyt-cross-validate";
import {
  fetchOcrSingle,
  mapBhytParsedToInsuranceUpdates,
  mapCccdParsedToFormUpdates,
  checkCccdOcrQuality,
  checkBhytOcrQuality,
  type OcrQualityResult,
} from "@/lib/cccd-ocr";
import { CCCD_REQUIRED_EMPTY, validateCccdRequired } from "@/lib/cccd-required";
import { submitPatientProfile } from "@/lib/patient-onboarding";
import { supabase } from "@/lib/supabase";

const pronounOptions = ["Anh/Nam", "Chị/Nữ", "Họ/Không xác định", "Khác"];
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const fieldClass =
  "min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30";
const fieldErrorClass = "border-destructive ring-1 ring-destructive/30";
const FieldErr = ({ msg }: { msg?: string }) =>
  msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;

const RequiredStar = () => (
  <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
);

const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const REQUIRED_EMPTY = CCCD_REQUIRED_EMPTY;

const OnboardingFormPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    data,
    uploadFiles,
    updatePersonal,
    updateIdentity,
    updateInsurance,
    updatePersonalFromOcr,
    updateIdentityFromOcr,
    updateInsuranceFromOcr,
    setAcceptedPrivacy,
    setIdFile,
    setIdBackFile,
    setCardFrontFile,
    resetForm,
  } = useOnboardingForm();

  const userId = session?.user?.id;

  const {
    dupState, bypassed, checking: isDupChecking,
    isBlocked, hasUnbypassedWarning,
    checkCccd, checkPhone, checkNameDob, checkAll,
    bypassPhone, bypassNameDob,
  } = useDuplicateCheck(userId, "onboarding");

  const {
    result: cccdBhytResult,
    confirmed: cccdBhytConfirmed,
    blocksSubmit: cccdBhytBlocksSubmit,
    confirm: confirmCccdBhytMismatch,
  } = useCccdBhytMismatch({
    cccdName: joinCccdFullName(data.personal.legalLastName, data.personal.legalFirstName),
    cccdDob: data.personal.dateOfBirth,
    bhytName: data.insurance.bhytName,
    bhytDob: data.insurance.bhytDob,
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  const [isOcrFrontRunning, setIsOcrFrontRunning] = useState(false);
  const [isOcrBackRunning, setIsOcrBackRunning] = useState(false);
  const [isOcrBhytRunning, setIsOcrBhytRunning] = useState(false);

  const [ocrFrontQuality, setOcrFrontQuality] = useState<OcrQualityResult | null>(null);
  const [ocrBackQuality, setOcrBackQuality] = useState<OcrQualityResult | null>(null);
  const [ocrBhytQuality, setOcrBhytQuality] = useState<OcrQualityResult | null>(null);

  const focusFirstEmptyCccdField = () => {
    const cccdFields = [
      { id: "idNumber", value: data.identity.idNumber },
      { id: "expirationDate", value: data.identity.expirationDate },
      { id: "residentialAddress", value: data.identity.residentialAddress },
      { id: "issuedDate", value: data.identity.issuedDate },
      { id: "issuer", value: data.identity.issuer },
      { id: "legalFirstName", value: data.personal.legalFirstName },
      { id: "legalLastName", value: data.personal.legalLastName },
      { id: "dateOfBirth", value: data.personal.dateOfBirth },
    ];
    for (const field of cccdFields) {
      if (!field.value?.trim()) {
        const el = document.getElementById(field.id);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el?.focus(), 100);
        return;
      }
    }
    const first = document.getElementById("idNumber");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => first?.focus(), 100);
  };

  const focusFirstEmptyBhytField = () => {
    const bhytFields = [
      { id: "insuranceProvider", value: data.insurance.provider },
      { id: "memberId", value: data.insurance.memberId },
      { id: "groupNumber", value: data.insurance.groupNumber },
      { id: "bhytName", value: data.insurance.bhytName },
      { id: "bhytDob", value: data.insurance.bhytDob },
      { id: "bhytKcb", value: data.insurance.bhytKcb },
    ];
    for (const field of bhytFields) {
      if (!field.value?.trim()) {
        const el = document.getElementById(field.id);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el?.focus(), 100);
        return;
      }
    }
    const first = document.getElementById("insuranceProvider");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => first?.focus(), 100);
  };

  const pickFile = (
    file: File | null,
    onMeta: (name: string) => void,
    onStore: (f: File | null) => void,
  ) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      setErrorMessage("File quá lớn. Vui lòng chọn file dưới 10MB.");
      return;
    }
    setErrorMessage("");
    onMeta(file.name);
    onStore(file);
  };

  const handleOcrFront = async () => {
    if (!uploadFiles.idFile) return;
    setIsOcrFrontRunning(true);
    setErrorMessage("");
    setOcrFrontQuality(null);
    try {
      const json = await fetchOcrSingle(uploadFiles.idFile, "cccd", "front");
      const quality = checkCccdOcrQuality(json);
      setOcrFrontQuality(quality);

      if (quality.isLowQuality) {
        toast.warning("Ảnh không đủ rõ", {
          description: quality.message,
        });
      }

      if (json.parsed && typeof json.parsed === "object") {
        const { identity, personal } = mapCccdParsedToFormUpdates(json.parsed);
        updateIdentityFromOcr(identity);
        updatePersonalFromOcr(personal);
      }

      if (!quality.isLowQuality) {
        toast.success("OCR CCCD mặt trước hoàn tất");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OCR thất bại.";
      setErrorMessage(msg);
      toast.error("OCR thất bại", { description: msg });
      setOcrFrontQuality({
        isLowQuality: true,
        confidence: 0,
        filledFieldCount: 0,
        totalExpectedFields: 5,
        message: "OCR thất bại. Vui lòng chụp lại hoặc nhập thủ công.",
      });
    } finally {
      setIsOcrFrontRunning(false);
    }
  };

  const handleOcrBack = async () => {
    if (!uploadFiles.idBackFile) return;
    setIsOcrBackRunning(true);
    setErrorMessage("");
    setOcrBackQuality(null);
    try {
      const json = await fetchOcrSingle(uploadFiles.idBackFile, "cccd", "front");
      const quality = checkCccdOcrQuality(json);
      setOcrBackQuality(quality);

      if (quality.isLowQuality) {
        toast.warning("Ảnh không đủ rõ", {
          description: quality.message,
        });
      }

      if (json.parsed && typeof json.parsed === "object") {
        const { identity, personal } = mapCccdParsedToFormUpdates(json.parsed);
        updateIdentityFromOcr(identity);
        updatePersonalFromOcr(personal);
      }

      if (!quality.isLowQuality) {
        toast.success("OCR CCCD mặt sau hoàn tất");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OCR thất bại.";
      setErrorMessage(msg);
      toast.error("OCR thất bại", { description: msg });
      setOcrBackQuality({
        isLowQuality: true,
        confidence: 0,
        filledFieldCount: 0,
        totalExpectedFields: 5,
        message: "OCR thất bại. Vui lòng chụp lại hoặc nhập thủ công.",
      });
    } finally {
      setIsOcrBackRunning(false);
    }
  };

  const handleOcrBhyt = async () => {
    if (!uploadFiles.cardFrontFile) return;
    setIsOcrBhytRunning(true);
    setErrorMessage("");
    setOcrBhytQuality(null);
    try {
      const json = await fetchOcrSingle(uploadFiles.cardFrontFile, "bhyt", "front");
      const quality = checkBhytOcrQuality(json);
      setOcrBhytQuality(quality);

      if (quality.isLowQuality) {
        toast.warning("Ảnh BHYT không đủ rõ", {
          description: quality.message,
        });
      }

      if (json.parsed && typeof json.parsed === "object") {
        updateInsuranceFromOcr(mapBhytParsedToInsuranceUpdates(json.parsed));
      }

      if (!quality.isLowQuality) {
        toast.success("OCR BHYT hoàn tất");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OCR BHYT thất bại.";
      setErrorMessage(msg);
      toast.error("OCR BHYT thất bại", { description: msg });
      setOcrBhytQuality({
        isLowQuality: true,
        confidence: 0,
        filledFieldCount: 0,
        totalExpectedFields: 4,
        message: "OCR BHYT thất bại. Vui lòng chụp lại hoặc nhập thủ công.",
      });
    } finally {
      setIsOcrBhytRunning(false);
    }
  };

  const validateForm = (): boolean => {
    const { legalFirstName, legalLastName, dateOfBirth, phoneNumber, email } = data.personal;
    const { provider, memberId, groupNumber } = data.insurance;
    const R = REQUIRED_EMPTY;

    const errs: Record<string, string> = {
      ...validateCccdRequired(data.identity),
    };
    if (!legalFirstName) errs.legalFirstName = R;
    if (!legalLastName) errs.legalLastName = R;
    if (!dateOfBirth) errs.dateOfBirth = R;
    if (!phoneNumber) errs.phoneNumber = R;
    if (!email) errs.email = R;
    if (!provider) errs.provider = R;
    if (!memberId) errs.memberId = R;
    if (!groupNumber) errs.groupNumber = R;
    if (!data.acceptedPrivacy) errs.privacy = "Vui lòng xác nhận đồng ý trước khi gửi.";

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setErrorMessage("Vui lòng điền đầy đủ các trường bắt buộc được đánh dấu bên dưới.");
      return false;
    }
    setErrorMessage("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (cccdBhytBlocksSubmit) {
      setErrorMessage("CCCD và thẻ BHYT không khớp. Vui lòng xác nhận hoặc tải lại giấy tờ.");
      return;
    }

    if (!userId) {
      setErrorMessage("Bạn cần đăng nhập để gửi hồ sơ.");
      return;
    }

    // Final duplicate check before submitting
    const fullName = [data.personal.legalFirstName, data.personal.legalLastName]
      .filter(Boolean).join(" ");
    const finalDup = await checkAll({
      cccd: data.identity.idNumber,
      phone: data.personal.phoneNumber,
      name: fullName,
      dob: data.personal.dateOfBirth,
    });
    if (finalDup.cccdMatchId) {
      setErrorMessage("Số CCCD đã tồn tại trong hệ thống. Không thể tạo hồ sơ mới.");
      return;
    }
    if (
      (finalDup.phoneMatchId && !bypassed.phone) ||
      (finalDup.nameDobMatchId && !bypassed.nameDob)
    ) {
      setErrorMessage("Vui lòng xác nhận các cảnh báo trùng trước khi tiếp tục.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await submitPatientProfile(supabase, userId, data, uploadFiles);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      toast.error("Không lưu được hồ sơ", { description: error.message });
      return;
    }

    toast.success("Hoàn tất đăng ký hồ sơ");
    resetForm();
    navigate("/account/personal");
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Chào mừng đến với Rcare Plus
      </h1>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Có thể tải ảnh CCCD và thẻ BHYT để OCR, hoặc bỏ trống và nhập thông tin thủ công.
      </p>

      <section className="mt-8 rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Tải ảnh giấy tờ để OCR (tùy chọn)</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Không bắt buộc. Có thể bỏ trống và nhập thông tin thủ công. Nếu tải ảnh, hệ thống sẽ tự động trích xuất thông tin.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <UploadCard
            id="identityUploadFront"
            title="Nhấn để tải lên hoặc kéo thả"
            hint="CCCD — mặt trước (tùy chọn)"
            fileName={data.identity.idFileName}
            file={uploadFiles.idFile}
            onFileSelect={(f) => { clearFieldError("idFile"); setOcrFrontQuality(null); pickFile(f, (n) => updateIdentity({ idFileName: n }), setIdFile); }}
            onOcr={handleOcrFront}
            isOcrRunning={isOcrFrontRunning}
            ocrQuality={ocrFrontQuality}
            onManualInput={focusFirstEmptyCccdField}
            error={fieldErrors.idFile}
          />
          <UploadCard
            id="identityUploadBack"
            title="Nhấn để tải lên hoặc kéo thả"
            hint="CCCD — mặt sau (tùy chọn)"
            fileName={data.identity.idBackFileName}
            file={uploadFiles.idBackFile}
            onFileSelect={(f) => { clearFieldError("idBackFile"); setOcrBackQuality(null); pickFile(f, (n) => updateIdentity({ idBackFileName: n }), setIdBackFile); }}
            onOcr={handleOcrBack}
            isOcrRunning={isOcrBackRunning}
            ocrQuality={ocrBackQuality}
            onManualInput={focusFirstEmptyCccdField}
            error={fieldErrors.idBackFile}
          />
          <UploadCard
            id="insuranceFrontUpload"
            title="Nhấn để tải lên hoặc kéo thả"
            hint="Bảo hiểm y tế (BHYT) (tùy chọn)"
            fileName={data.insurance.cardFrontFileName}
            file={uploadFiles.cardFrontFile}
            onFileSelect={(f) => { clearFieldError("cardFrontFile"); setOcrBhytQuality(null); pickFile(f, (n) => updateInsurance({ cardFrontFileName: n }), setCardFrontFile); }}
            onOcr={handleOcrBhyt}
            isOcrRunning={isOcrBhytRunning}
            ocrQuality={ocrBhytQuality}
            onManualInput={focusFirstEmptyBhytField}
            error={fieldErrors.cardFrontFile}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void (async () => {
              await handleOcrFront();
              await handleOcrBack();
              await handleOcrBhyt();
            })()}
            disabled={
              isOcrFrontRunning || isOcrBackRunning || isOcrBhytRunning ||
              (!uploadFiles.idFile && !uploadFiles.idBackFile && !uploadFiles.cardFrontFile)
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            {isOcrFrontRunning || isOcrBackRunning || isOcrBhytRunning ? "Đang đọc OCR…" : "OCR tất cả"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          OCR sử dụng{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">/public/ocr/cccd</code> và{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">/public/ocr/bhyt</code>.
          Đặt <code className="rounded bg-muted px-1 font-mono text-[11px]">VITE_OCR_CCCD_URL</code> nếu
          cần.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border bg-muted/40 p-5 md:p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Thông tin tự động từ CCCD
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="idNumber" className={labelClass}>Số CCCD<RequiredStar /></label>
            <input
              id="idNumber" type="text"
              value={data.identity.idNumber}
              onChange={(e) => { clearFieldError("idNumber"); updateIdentity({ idNumber: e.target.value }); }}
              onBlur={() => void checkCccd(data.identity.idNumber)}
              className={`${fieldClass} ${dupState.cccdMatchId || fieldErrors.idNumber ? fieldErrorClass : ""}`}
              placeholder="G-123-5678-9012"
            />
            {dupState.cccdMatchId ? (
              <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span><strong>Trùng CCCD.</strong> Số CCCD này đã có hồ sơ trong hệ thống. Không thể tạo mới.</span>
              </div>
            ) : <FieldErr msg={fieldErrors.idNumber} />}
          </div>
          <div>
            <label htmlFor="expirationDate" className={labelClass}>Ngày hết hạn<RequiredStar /></label>
            <input id="expirationDate" type="date" value={data.identity.expirationDate}
              onChange={(e) => { clearFieldError("expirationDate"); updateIdentity({ expirationDate: e.target.value }); }}
              className={`${fieldClass} ${fieldErrors.expirationDate ? fieldErrorClass : ""}`} />
            <FieldErr msg={fieldErrors.expirationDate} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="residentialAddress" className={labelClass}>Địa chỉ thường trú<RequiredStar /></label>
            <input id="residentialAddress" type="text" value={data.identity.residentialAddress}
              onChange={(e) => { clearFieldError("residentialAddress"); updateIdentity({ residentialAddress: e.target.value }); }}
              className={`${fieldClass} ${fieldErrors.residentialAddress ? fieldErrorClass : ""}`}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" />
            <FieldErr msg={fieldErrors.residentialAddress} />
          </div>
          <div>
            <label htmlFor="issuedDate" className={labelClass}>Ngày cấp<RequiredStar /></label>
            <input id="issuedDate" type="date" value={data.identity.issuedDate}
              onChange={(e) => { clearFieldError("issuedDate"); updateIdentity({ issuedDate: e.target.value }); }}
              className={`${fieldClass} ${fieldErrors.issuedDate ? fieldErrorClass : ""}`} />
            <FieldErr msg={fieldErrors.issuedDate} />
          </div>
          <div>
            <label htmlFor="issuer" className={labelClass}>Nơi cấp<RequiredStar /></label>
            <textarea id="issuer" rows={3} value={data.identity.issuer}
              onChange={(e) => { clearFieldError("issuer"); updateIdentity({ issuer: e.target.value }); }}
              className={`${fieldClass} py-2 overflow-y-auto resize-none ${fieldErrors.issuer ? fieldErrorClass : ""}`}
              placeholder="Cục cảnh sát QLHC về TTXH" />
            <FieldErr msg={fieldErrors.issuer} />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Thông tin cá nhân</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="legalFirstName" className={labelClass}>Họ (theo giấy tờ)<RequiredStar /></label>
            <input
              id="legalFirstName" type="text"
              value={data.personal.legalFirstName}
              onChange={(e) => { clearFieldError("legalFirstName"); updatePersonal({ legalFirstName: e.target.value }); }}
              onBlur={() => {
                const name = [data.personal.legalFirstName, data.personal.legalLastName].filter(Boolean).join(" ");
                void checkNameDob(name, data.personal.dateOfBirth);
              }}
              className={`${fieldClass} ${cccdBhytResult.nameMismatch || fieldErrors.legalFirstName ? fieldErrorClass : ""}`}
              placeholder="Nhập đúng như trên giấy tờ"
            />
            <FieldErr msg={fieldErrors.legalFirstName} />
          </div>
          <div>
            <label htmlFor="legalLastName" className={labelClass}>Tên (theo giấy tờ)<RequiredStar /></label>
            <input
              id="legalLastName" type="text"
              value={data.personal.legalLastName}
              onChange={(e) => { clearFieldError("legalLastName"); updatePersonal({ legalLastName: e.target.value }); }}
              onBlur={() => {
                const name = [data.personal.legalFirstName, data.personal.legalLastName].filter(Boolean).join(" ");
                void checkNameDob(name, data.personal.dateOfBirth);
              }}
              className={`${fieldClass} ${cccdBhytResult.nameMismatch || fieldErrors.legalLastName ? fieldErrorClass : ""}`}
              placeholder="Nhập đúng như trên giấy tờ"
            />
            <FieldErr msg={fieldErrors.legalLastName} />
          </div>
          <div>
            <label htmlFor="dateOfBirth" className={labelClass}>Ngày sinh<RequiredStar /></label>
            <input
              id="dateOfBirth" type="date"
              value={data.personal.dateOfBirth}
              onChange={(e) => { clearFieldError("dateOfBirth"); updatePersonal({ dateOfBirth: e.target.value }); }}
              onBlur={() => {
                const name = [data.personal.legalFirstName, data.personal.legalLastName].filter(Boolean).join(" ");
                void checkNameDob(name, data.personal.dateOfBirth);
              }}
              className={`${fieldClass} ${cccdBhytResult.dobMismatch || fieldErrors.dateOfBirth ? fieldErrorClass : dupState.nameDobMatchId && !bypassed.nameDob ? "border-warning ring-1 ring-warning/30" : ""}`}
            />
            <FieldErr msg={fieldErrors.dateOfBirth} />
          </div>
          <div>
            <label htmlFor="phoneNumber" className={labelClass}>Số điện thoại<RequiredStar /></label>
            <input
              id="phoneNumber" type="tel"
              value={data.personal.phoneNumber}
              onChange={(e) => { clearFieldError("phoneNumber"); updatePersonal({ phoneNumber: e.target.value }); }}
              onBlur={() => void checkPhone(data.personal.phoneNumber)}
              className={`${fieldClass} ${dupState.phoneMatchId && !bypassed.phone ? "border-warning ring-1 ring-warning/30" : fieldErrors.phoneNumber ? fieldErrorClass : ""}`}
              placeholder="0912 345 678"
            />
            {dupState.phoneMatchId && !bypassed.phone ? (
              <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>Cảnh báo: </strong>Số điện thoại này đã tồn tại trong hệ thống.{" "}
                  <button type="button" onClick={bypassPhone} className="font-semibold underline hover:no-underline">
                    Vẫn tạo mới
                  </button>
                </span>
              </div>
            ) : <FieldErr msg={fieldErrors.phoneNumber} />}
          </div>
          {dupState.nameDobMatchId && !bypassed.nameDob ? (
            <div className="md:col-span-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Cảnh báo: </strong>Họ tên + ngày sinh này đã khớp với một hồ sơ trong hệ thống.{" "}
                <button type="button" onClick={bypassNameDob} className="font-semibold underline hover:no-underline">
                  Vẫn tạo mới
                </button>
              </span>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <label htmlFor="emailAddress" className={labelClass}>Địa chỉ Email<RequiredStar /></label>
            <input id="emailAddress" type="email" value={data.personal.email}
              onChange={(e) => { clearFieldError("email"); updatePersonal({ email: e.target.value }); }}
              className={`${fieldClass} ${fieldErrors.email ? fieldErrorClass : ""}`}
              placeholder="ten@example.com" />
            <FieldErr msg={fieldErrors.email} />
          </div>
        </div>
        <div className="mt-6">
          <p className={labelClass}>Đại từ xưng hô</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {pronounOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updatePersonal({ pronouns: option })}
                className={`min-h-11 rounded-xl border px-4 text-sm transition-colors ${
                  data.personal.pronouns === option
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-primary/40"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-muted/40 p-5 md:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Thông tin bảo hiểm</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="insuranceProvider" className={labelClass}>Đơn vị bảo hiểm<RequiredStar /></label>
            <input id="insuranceProvider" type="text" value={data.insurance.provider}
              onChange={(e) => { clearFieldError("provider"); updateInsurance({ provider: e.target.value }); }}
              className={`${fieldClass} ${fieldErrors.provider ? fieldErrorClass : ""}`}
              placeholder="Tìm hoặc chọn đơn vị bảo hiểm" />
            <FieldErr msg={fieldErrors.provider} />
          </div>
          <div>
            <label htmlFor="memberId" className={labelClass}>Số thẻ BHYT<RequiredStar /></label>
            <input id="memberId" type="text" value={data.insurance.memberId}
              onChange={(e) => { clearFieldError("memberId"); updateInsurance({ memberId: e.target.value }); }}
              className={`${fieldClass} ${fieldErrors.memberId ? fieldErrorClass : ""}`}
              placeholder="HS4012345678901" />
            <FieldErr msg={fieldErrors.memberId} />
          </div>
          <div>
            <label htmlFor="groupNumber" className={labelClass}>Mã nhóm<RequiredStar /></label>
            <input id="groupNumber" type="text" value={data.insurance.groupNumber}
              onChange={(e) => { clearFieldError("groupNumber"); updateInsurance({ groupNumber: e.target.value }); }}
              className={`${fieldClass} ${fieldErrors.groupNumber ? fieldErrorClass : ""}`}
              placeholder="GRP98765" />
            <FieldErr msg={fieldErrors.groupNumber} />
          </div>
          <div>
            <label htmlFor="bhytName" className={labelClass}>Họ tên (BHYT)</label>
            <input id="bhytName" type="text" value={data.insurance.bhytName} onChange={(e) => updateInsurance({ bhytName: e.target.value })} className={`${fieldClass} ${cccdBhytResult.nameMismatch ? fieldErrorClass : ""}`} />
          </div>
          <div>
            <label htmlFor="bhytDob" className={labelClass}>Ngày sinh (BHYT)</label>
            <input id="bhytDob" type="date" value={data.insurance.bhytDob} onChange={(e) => updateInsurance({ bhytDob: e.target.value })} className={`${fieldClass} ${cccdBhytResult.dobMismatch ? fieldErrorClass : ""}`} />
          </div>
          <div>
            <label htmlFor="bhytGender" className={labelClass}>Giới tính (BHYT)</label>
            <input id="bhytGender" type="text" value={data.insurance.bhytGender} onChange={(e) => updateInsurance({ bhytGender: e.target.value })} className={fieldClass} placeholder="Nam / Nữ" />
          </div>
          <div>
            <label htmlFor="bhytKcbCode" className={labelClass}>Mã KCB ban đầu</label>
            <input id="bhytKcbCode" type="text" value={data.insurance.bhytKcbCode} onChange={(e) => updateInsurance({ bhytKcbCode: e.target.value })} className={fieldClass} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="bhytAddress" className={labelClass}>Địa chỉ / Đơn vị (BHYT)</label>
            <input id="bhytAddress" type="text" value={data.insurance.bhytAddress} onChange={(e) => updateInsurance({ bhytAddress: e.target.value })} className={fieldClass} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="bhytKcb" className={labelClass}>Nơi đăng ký KCB ban đầu</label>
            <input id="bhytKcb" type="text" value={data.insurance.bhytKcb} onChange={(e) => updateInsurance({ bhytKcb: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="bhytValidFrom" className={labelClass}>Có giá trị từ ngày</label>
            <input id="bhytValidFrom" type="date" value={data.insurance.bhytValidFrom} onChange={(e) => updateInsurance({ bhytValidFrom: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="bhytFiveYear" className={labelClass}>Ngày đủ 5 năm liên tục</label>
            <input id="bhytFiveYear" type="date" value={data.insurance.bhytFiveYear} onChange={(e) => updateInsurance({ bhytFiveYear: e.target.value })} className={fieldClass} />
          </div>
        </div>
      </section>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Quyền riêng tư của bạn là ưu tiên hàng đầu của chúng tôi. Dữ liệu được mã hóa cấp độ ngân hàng và chỉ chia sẻ với đội ngũ chăm sóc sức khỏe được cấp phép.
        </p>
      </div>

      <div className={`mt-5 flex items-start gap-2 rounded-xl border border-dashed bg-card p-4 ${fieldErrors.privacy ? "border-destructive/50 ring-1 ring-destructive/30" : ""}`}>
        <Checkbox
          id="privacyConsent"
          checked={data.acceptedPrivacy}
          onCheckedChange={(checked) => { clearFieldError("privacy"); setAcceptedPrivacy(checked === true); }}
          className="mt-0.5"
        />
        <div>
          <label htmlFor="privacyConsent" className="cursor-pointer text-sm text-muted-foreground">
            Tôi xác nhận tất cả thông tin đã cung cấp là chính xác và đồng ý cho phép xử lý dữ liệu an toàn để phục vụ công tác chăm sóc sức khỏe.
            <RequiredStar />
          </label>
          <FieldErr msg={fieldErrors.privacy} />
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <CccdBhytMismatchBanner
        result={cccdBhytResult}
        confirmed={cccdBhytConfirmed}
        onConfirm={confirmCccdBhytMismatch}
        onReupload={() => {
          document.getElementById("identityUploadFront")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }}
      />

      <OnboardingActions
        nextLabel="Gửi hồ sơ bệnh nhân"
        onNext={handleSubmit}
        isSubmitting={isSubmitting || isDupChecking}
        disabled={isBlocked || hasUnbypassedWarning || cccdBhytBlocksSubmit}
      />
    </div>
  );
};

export default OnboardingFormPage;
