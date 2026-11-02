import { useState } from "react";
import { ScanLine, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import OnboardingActions from "@/components/onboarding/OnboardingActions";
import UploadCard from "@/components/onboarding/UploadCard";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import { fetchBhytOcr, mapBhytParsedToInsuranceUpdates } from "@/lib/cccd-ocr";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const OnboardingInsurance = () => {
  const navigate = useNavigate();
  const { data, uploadFiles, updateInsurance, updateInsuranceFromOcr, setCardFrontFile } = useOnboardingForm();
  const [errorMessage, setErrorMessage] = useState("");
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  const handleInsuranceFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      setErrorMessage("Tệp thẻ BHYT phải dưới 10MB.");
      return;
    }

    setErrorMessage("");
    updateInsurance({ cardFrontFileName: file.name });
    setCardFrontFile(file);
  };

  const handleRunBhytOcr = async () => {
    if (!uploadFiles.cardFrontFile) {
      setErrorMessage("Vui lòng tải lên ảnh thẻ BHYT trước khi chạy OCR.");
      return;
    }

    setErrorMessage("");
    setIsOcrRunning(true);
    try {
      const json = await fetchBhytOcr(uploadFiles.cardFrontFile);
      if (!json.parsed || typeof json.parsed !== "object") {
        throw new Error("Phản hồi BHYT OCR không chứa dữ liệu đã phân tích.");
      }
      updateInsuranceFromOcr(mapBhytParsedToInsuranceUpdates(json.parsed));
      toast.success("OCR BHYT hoàn tất", {
        description: "Các trường bảo hiểm gợi ý đã được điền.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "OCR BHYT thất bại.";
      setErrorMessage(message);
      toast.error("OCR BHYT thất bại", { description: message });
    } finally {
      setIsOcrRunning(false);
    }
  };

  const handleNext = () => {
    setErrorMessage("");
    const { provider, memberId, groupNumber, cardFrontFileName } = data.insurance;
    if (!provider || !memberId || !groupNumber || !cardFrontFileName) {
      setErrorMessage("Vui lòng điền đầy đủ thông tin bảo hiểm và tải lên ảnh thẻ BHYT.");
      return;
    }
    navigate("/onboarding/review");
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Thông tin bảo hiểm</h1>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Cung cấp thông tin bảo hiểm chính để hỗ trợ thanh toán và kiểm tra quyền lợi.
      </p>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Tải lên thẻ BHYT</h2>
        <UploadCard
          id="insuranceFrontUpload"
          title="Ảnh BHYT"
          hint="Chạm để chụp hoặc tải lên"
          fileName={data.insurance.cardFrontFileName}
          file={uploadFiles.cardFrontFile}
          onFileSelect={handleInsuranceFile}
        />
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void handleRunBhytOcr()}
            disabled={isOcrRunning || !uploadFiles.cardFrontFile}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            {isOcrRunning ? "Đang đọc BHYT..." : "Quét OCR BHYT"}
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-muted/40 p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="insuranceProvider" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nhà cung cấp bảo hiểm
            </label>
            <input
              id="insuranceProvider"
              type="text"
              value={data.insurance.provider}
              onChange={(event) => updateInsurance({ provider: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Tìm hoặc chọn nhà cung cấp"
            />
          </div>
          <div>
            <label htmlFor="memberId" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mã thành viên
            </label>
            <input
              id="memberId"
              type="text"
              value={data.insurance.memberId}
              onChange={(event) => updateInsurance({ memberId: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="ABC123456789"
            />
          </div>
          <div>
            <label htmlFor="groupNumber" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mã nhóm
            </label>
            <input
              id="groupNumber"
              type="text"
              value={data.insurance.groupNumber}
              onChange={(event) => updateInsurance({ groupNumber: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="GRP98765"
            />
          </div>
          <div>
            <label htmlFor="bhytName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Họ tên BHYT
            </label>
            <input
              id="bhytName"
              type="text"
              value={data.insurance.bhytName}
              onChange={(event) => updateInsurance({ bhytName: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Họ tên trên thẻ BHYT"
            />
          </div>
          <div>
            <label htmlFor="bhytDob" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ngày sinh BHYT
            </label>
            <input
              id="bhytDob"
              type="date"
              value={data.insurance.bhytDob}
              onChange={(event) => updateInsurance({ bhytDob: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="bhytGender" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Giới tính BHYT
            </label>
            <input
              id="bhytGender"
              type="text"
              value={data.insurance.bhytGender}
              onChange={(event) => updateInsurance({ bhytGender: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Nam / Nữ"
            />
          </div>
          <div>
            <label htmlFor="bhytKcbCode" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mã KCB
            </label>
            <input
              id="bhytKcbCode"
              type="text"
              value={data.insurance.bhytKcbCode}
              onChange={(event) => updateInsurance({ bhytKcbCode: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="79-536"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="bhytAddress" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Địa chỉ / Đơn vị BHYT
            </label>
            <input
              id="bhytAddress"
              type="text"
              value={data.insurance.bhytAddress}
              onChange={(event) => updateInsurance({ bhytAddress: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Địa chỉ hoặc đơn vị trên thẻ BHYT"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="bhytKcb" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nơi đăng ký KCB
            </label>
            <input
              id="bhytKcb"
              type="text"
              value={data.insurance.bhytKcb}
              onChange={(event) => updateInsurance({ bhytKcb: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Cơ sở khám chữa bệnh ban đầu"
            />
          </div>
          <div>
            <label htmlFor="bhytValidFrom" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Có hiệu lực từ
            </label>
            <input
              id="bhytValidFrom"
              type="date"
              value={data.insurance.bhytValidFrom}
              onChange={(event) => updateInsurance({ bhytValidFrom: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="bhytFiveYear" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ngày 5 năm
            </label>
            <input
              id="bhytFiveYear"
              type="date"
              value={data.insurance.bhytFiveYear}
              onChange={(event) => updateInsurance({ bhytFiveYear: event.target.value })}
              className="min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
        </div>
      </section>

      <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Thông tin được bảo mật: Dữ liệu được mã hóa AES-256 và không bao giờ chia sẻ với bên thứ ba không được phép.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <OnboardingActions
        previousPath="/onboarding/personal"
        nextLabel="Tiếp tục: Xác nhận"
        onNext={handleNext}
      />
    </div>
  );
};

export default OnboardingInsurance;
