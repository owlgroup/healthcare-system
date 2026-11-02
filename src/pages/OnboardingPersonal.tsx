import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import OnboardingActions from "@/components/onboarding/OnboardingActions";
import UploadCard from "@/components/onboarding/UploadCard";
import { fetchCccdOcr, mapCccdParsedToFormUpdates } from "@/lib/cccd-ocr";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";

const pronounOptions = ["Anh/Ông", "Chị/Bà", "Họ", "Khác"];
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const OnboardingPersonal = () => {
  const navigate = useNavigate();
  const { data, uploadFiles, updatePersonal, updateIdentity, updatePersonalFromOcr, updateIdentityFromOcr, setIdFile, setIdBackFile } =
    useOnboardingForm();
  const [errorMessage, setErrorMessage] = useState("");
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  const handleIdentityFront = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      setErrorMessage("Tệp CCCD quá lớn. Vui lòng tải lên tệp dưới 10MB.");
      return;
    }
    setErrorMessage("");
    updateIdentity({ idFileName: file.name });
    setIdFile(file);
  };

  const handleIdentityBack = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      setErrorMessage("Tệp CCCD quá lớn. Vui lòng tải lên tệp dưới 10MB.");
      return;
    }
    setErrorMessage("");
    updateIdentity({ idBackFileName: file.name });
    setIdBackFile(file);
  };

  const handleRunOcr = async () => {
    if (!uploadFiles.idFile || !uploadFiles.idBackFile) {
      setErrorMessage("Tải lên mặt trước và mặt sau CCCD, sau đó chạy OCR.");
      return;
    }
    setErrorMessage("");
    setIsOcrRunning(true);
    try {
      const json = await fetchCccdOcr(uploadFiles.idFile, uploadFiles.idBackFile);
      const parsed = json.parsed;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Phản hồi OCR không chứa dữ liệu đã phân tích.");
      }
      const { identity, personal } = mapCccdParsedToFormUpdates(parsed);
      updateIdentityFromOcr(identity);
      updatePersonalFromOcr(personal);
      toast.success("OCR hoàn tất", { description: "Xem lại và chỉnh sửa các trường được gợi ý bên dưới." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Yêu cầu OCR thất bại.";
      setErrorMessage(msg);
      toast.error("OCR thất bại", { description: msg });
    } finally {
      setIsOcrRunning(false);
    }
  };

  const handleNext = () => {
    setErrorMessage("");

    const { legalFirstName, legalLastName, dateOfBirth, phoneNumber, email } = data.personal;
    const {
      idNumber,
      expirationDate,
      residentialAddress,
      issuedDate,
      issuer,
      idFileName,
      idBackFileName,
    } = data.identity;

    if (
      !idFileName ||
      !idBackFileName ||
      !idNumber ||
      !expirationDate ||
      !residentialAddress ||
      !issuedDate ||
      !issuer
    ) {
      setErrorMessage("Vui lòng tải lên cả hai mặt CCCD và điền đầy đủ thông tin định danh.");
      return;
    }

    if (!legalFirstName || !legalLastName || !dateOfBirth || !phoneNumber || !email) {
      setErrorMessage("Vui lòng điền đầy đủ các trường thông tin cá nhân bắt buộc.");
      return;
    }

    navigate("/onboarding/insurance");
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Chào mừng đến Rcare Plus</h1>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Hãy bắt đầu với thông tin định danh và cá nhân để đảm bảo chăm sóc an toàn và chính xác.
      </p>

      <section className="mt-8 rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Xác minh định danh</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Tải lên ảnh rõ nét cả hai mặt CCCD/CMND. Chạy OCR để gợi ý các trường bên dưới, sau đó
          xem lại và chỉnh sửa nếu cần.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <UploadCard
            id="identityUploadFront"
            title="Nhấn để tải lên hoặc kéo thả"
            hint="CCCD/CMND (mặt trước)"
            fileName={data.identity.idFileName}
            file={uploadFiles.idFile}
            onFileSelect={handleIdentityFront}
          />
          <UploadCard
            id="identityUploadBack"
            title="Nhấn để tải lên hoặc kéo thả"
            hint="CCCD/CMND (mặt sau)"
            fileName={data.identity.idBackFileName}
            file={uploadFiles.idBackFile}
            onFileSelect={handleIdentityBack}
          />
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            OCR sử dụng dịch vụ cục bộ{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">/public/ocr/cccd</code>
            . Đặt <code className="rounded bg-muted px-1 font-mono text-[11px]">VITE_OCR_CCCD_URL</code> nếu
            chạy trên máy chủ khác.
          </p>
          <button
            type="button"
            onClick={() => void handleRunOcr()}
            disabled={isOcrRunning || !uploadFiles.idFile || !uploadFiles.idBackFile}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            {isOcrRunning ? "Đang đọc CCCD…" : "Quét OCR CCCD"}
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border bg-muted/40 p-5 md:p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Thông tin tự điền từ CCCD
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="idNumber"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Số CCCD/CMND
            </label>
            <input
              id="idNumber"
              type="text"
              value={data.identity.idNumber}
              onChange={(event) => updateIdentity({ idNumber: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="001234567890"
            />
          </div>
          <div>
            <label
              htmlFor="expirationDate"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Ngày hết hạn
            </label>
            <input
              id="expirationDate"
              type="date"
              value={data.identity.expirationDate}
              onChange={(event) => updateIdentity({ expirationDate: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="residentialAddress"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Địa chỉ thường trú
            </label>
            <input
              id="residentialAddress"
              type="text"
              value={data.identity.residentialAddress}
              onChange={(event) => updateIdentity({ residentialAddress: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="123 Đường ABC, Quận 1, TP.HCM"
            />
          </div>
          <div>
            <label
              htmlFor="issuedDate"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Ngày cấp
            </label>
            <input
              id="issuedDate"
              type="date"
              value={data.identity.issuedDate}
              onChange={(event) => updateIdentity({ issuedDate: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div>
            <label
              htmlFor="issuer"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Nơi cấp
            </label>
            <input
              id="issuer"
              type="text"
              value={data.identity.issuer}
              onChange={(event) => updateIdentity({ issuer: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Cục Cảnh sát QLHC về TTXH"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Thông tin cá nhân</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="legalFirstName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tên (theo giấy tờ)
            </label>
            <input
              id="legalFirstName"
              type="text"
              required
              value={data.personal.legalFirstName}
              onChange={(event) => updatePersonal({ legalFirstName: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Nhập theo CCCD/CMND"
            />
          </div>
          <div>
            <label htmlFor="legalLastName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Họ (theo giấy tờ)
            </label>
            <input
              id="legalLastName"
              type="text"
              required
              value={data.personal.legalLastName}
              onChange={(event) => updatePersonal({ legalLastName: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Nhập theo CCCD/CMND"
            />
          </div>
          <div>
            <label htmlFor="dateOfBirth" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ngày sinh
            </label>
            <input
              id="dateOfBirth"
              type="date"
              required
              value={data.personal.dateOfBirth}
              onChange={(event) => updatePersonal({ dateOfBirth: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="phoneNumber" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Số điện thoại
            </label>
            <input
              id="phoneNumber"
              type="tel"
              required
              value={data.personal.phoneNumber}
              onChange={(event) => updatePersonal({ phoneNumber: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="0901234567"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="emailAddress" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              id="emailAddress"
              type="email"
              required
              value={data.personal.email}
              onChange={(event) => updatePersonal({ email: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <div className="mt-7">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Đại từ xưng hô
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {pronounOptions.map((option) => {
              const selected = data.personal.pronouns === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => updatePersonal({ pronouns: option })}
                  className={`min-h-11 rounded-xl border px-4 text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Quyền riêng tư của bạn là ưu tiên hàng đầu. Chúng tôi sử dụng mã hóa cấp ngân hàng và chỉ
          chia sẻ dữ liệu với đội ngũ chăm sóc được cấp phép của bạn.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <OnboardingActions nextLabel="Tiếp tục: Bảo hiểm" onNext={handleNext} />
    </div>
  );
};

export default OnboardingPersonal;
