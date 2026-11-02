import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import OnboardingActions from "@/components/onboarding/OnboardingActions";
import UploadCard from "@/components/onboarding/UploadCard";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const OnboardingIdentity = () => {
  const navigate = useNavigate();
  const { data, updateIdentity, setIdFile, setIdBackFile } = useOnboardingForm();
  const [errorMessage, setErrorMessage] = useState("");

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

  const handleNext = () => {
    setErrorMessage("");
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
    navigate("/onboarding/insurance");
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Xác minh định danh</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Tải lên ảnh CCCD/CMND rõ nét để chúng tôi xác minh thông tin của bạn một cách an toàn.
      </p>

      <section className="mt-8">
        <div className="grid gap-4 md:grid-cols-2">
          <UploadCard
            id="identityUploadFront"
            title="Nhấn để tải lên hoặc kéo thả"
            hint="CCCD/CMND (mặt trước)"
            fileName={data.identity.idFileName}
            onFileSelect={handleIdentityFront}
          />
          <UploadCard
            id="identityUploadBack"
            title="Nhấn để tải lên hoặc kéo thả"
            hint="CCCD/CMND (mặt sau)"
            fileName={data.identity.idBackFileName}
            onFileSelect={handleIdentityBack}
          />
        </div>
      </section>

      <section className="mt-6 rounded-xl bg-muted/40 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Thông tin tự điền từ CCCD
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="idNumber" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Số CCCD/CMND
            </label>
            <input
              id="idNumber"
              type="text"
              value={data.identity.idNumber}
              onChange={(event) => updateIdentity({ idNumber: event.target.value })}
              className="min-h-11 w-full rounded-lg border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="001234567890"
            />
          </div>
          <div>
            <label htmlFor="expirationDate" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ngày hết hạn
            </label>
            <input
              id="expirationDate"
              type="date"
              value={data.identity.expirationDate}
              onChange={(event) => updateIdentity({ expirationDate: event.target.value })}
              className="min-h-11 w-full rounded-lg border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="residentialAddress" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Địa chỉ thường trú
            </label>
            <input
              id="residentialAddress"
              type="text"
              value={data.identity.residentialAddress}
              onChange={(event) => updateIdentity({ residentialAddress: event.target.value })}
              className="min-h-11 w-full rounded-lg border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="123 Đường ABC, Quận 1, TP.HCM"
            />
          </div>
          <div>
            <label htmlFor="issuedDate" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ngày cấp
            </label>
            <input
              id="issuedDate"
              type="date"
              value={data.identity.issuedDate}
              onChange={(event) => updateIdentity({ issuedDate: event.target.value })}
              className="min-h-11 w-full rounded-lg border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="issuer" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nơi cấp
            </label>
            <input
              id="issuer"
              type="text"
              value={data.identity.issuer}
              onChange={(event) => updateIdentity({ issuer: event.target.value })}
              className="min-h-11 w-full rounded-lg border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Cục Cảnh sát QLHC về TTXH"
            />
          </div>
        </div>
      </section>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Quyền riêng tư của bạn là ưu tiên hàng đầu. Chúng tôi sử dụng mã hóa cấp ngân hàng và chỉ chia sẻ dữ liệu với đội ngũ chăm sóc được cấp phép của bạn.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <OnboardingActions
        previousPath="/onboarding/personal"
        nextLabel="Tiếp tục: Bảo hiểm"
        onNext={handleNext}
      />
    </div>
  );
};

export default OnboardingIdentity;
