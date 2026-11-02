import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import OnboardingActions from "@/components/onboarding/OnboardingActions";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import { submitPatientProfile } from "@/lib/patient-onboarding";
import { supabase } from "@/lib/supabase";

const NA = "Chưa có";
const NOT_UPLOADED = "Chưa tải lên";

const OnboardingReview = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data, uploadFiles, setAcceptedPrivacy, resetForm } = useOnboardingForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    setErrorMessage("");
    if (!data.acceptedPrivacy) {
      setErrorMessage("Vui lòng xác nhận đồng ý quyền riêng tư trước khi gửi.");
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      setErrorMessage("Bạn cần đăng nhập để gửi hồ sơ.");
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

    toast.success("Hoàn tất đăng ký", {
      description: "Hồ sơ bệnh nhân đã được gửi thành công.",
    });
    resetForm();
    navigate("/account/personal");
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Xem lại & xác nhận</h1>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Kiểm tra thông tin trước khi gửi. Bạn có thể quay lại bất kỳ bước nào để chỉnh sửa.
      </p>

      <div className="mt-8 grid gap-4">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Thông tin cá nhân</h2>
          <p className="mt-2 text-sm text-foreground">
            {data.personal.legalFirstName} {data.personal.legalLastName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ngày sinh: {data.personal.dateOfBirth || NA} · Điện thoại: {data.personal.phoneNumber || NA}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Email: {data.personal.email || NA} · Xưng hô: {data.personal.pronouns || NA}
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Định danh</h2>
          <p className="mt-2 text-sm text-foreground">Số CCCD/CMND: {data.identity.idNumber || NA}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Địa chỉ: {data.identity.residentialAddress || NA}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cấp ngày: {data.identity.issuedDate || NA} · Hết hạn: {data.identity.expirationDate || NA}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nơi cấp: {data.identity.issuer || NA} · Mặt trước:{" "}
            {data.identity.idFileName || NOT_UPLOADED} · Mặt sau:{" "}
            {data.identity.idBackFileName || NOT_UPLOADED}
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bảo hiểm</h2>
          <p className="mt-2 text-sm text-foreground">Nhà cung cấp: {data.insurance.provider || NA}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mã thành viên: {data.insurance.memberId || NA} · Nhóm: {data.insurance.groupNumber || NA}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ảnh BHYT: {data.insurance.cardFrontFileName || NOT_UPLOADED}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tên BHYT: {data.insurance.bhytName || NA} · Giới tính: {data.insurance.bhytGender || NA}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ngày sinh BHYT: {data.insurance.bhytDob || NA} · Hiệu lực từ: {data.insurance.bhytValidFrom || NA}
          </p>
        </section>
      </div>

      <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Chúng tôi chỉ chia sẻ thông tin với bác sĩ/nhân viên y tế có giấy phép tham gia chăm sóc bạn.
        </p>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-dashed bg-card p-4">
        <Checkbox
          id="privacyConsent"
          checked={data.acceptedPrivacy}
          onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
          className="mt-0.5"
        />
        <label htmlFor="privacyConsent" className="cursor-pointer text-sm text-muted-foreground">
          Tôi xác nhận mọi thông tin cung cấp là chính xác và đồng ý xử lý bảo mật để phối hợp chăm sóc.
        </label>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Sẵn sàng gửi sau khi xác nhận đồng ý.
      </div>

      <OnboardingActions
        previousPath="/onboarding/insurance"
        nextLabel="Gửi hồ sơ bệnh nhân"
        onNext={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default OnboardingReview;
