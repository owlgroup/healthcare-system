import { Mail } from "lucide-react";

type ConfirmStepProps = {
  email: string;
  isSubmitting: boolean;
  errorMessage: string;
  resendCooldown: number;
  onBack: () => void;
  onResend: () => void;
};

const ConfirmStep = ({
  email,
  isSubmitting,
  errorMessage,
  resendCooldown,
  onBack,
  onResend,
}: ConfirmStepProps) => (
  <div>
    <div className="mb-6 flex justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-7 w-7 text-primary" />
      </div>
    </div>

    <p className="mb-2 text-center text-sm text-muted-foreground">
      Chúng tôi đã gửi email xác nhận tới
    </p>
    <p className="mb-4 text-center text-sm font-semibold text-foreground">{email}</p>

    <ol className="mb-6 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
      <li>Mở hộp thư (và thư mục Spam).</li>
      <li>Nhấn link <strong className="text-foreground">Xác nhận email của bạn</strong>.</li>
      <li>Trình duyệt sẽ quay lại app — tiếp tục đặt mật khẩu.</li>
    </ol>

    {errorMessage ? (
      <div className="mb-4 text-sm text-destructive" role="alert">
        {errorMessage}
      </div>
    ) : null}

    <p className="mb-4 text-center text-xs text-muted-foreground">
      Trang này tự chuyển sang bước mật khẩu sau khi bạn nhấn link xác nhận.
    </p>

    <button
      type="button"
      onClick={onResend}
      disabled={isSubmitting || resendCooldown > 0}
      className="mb-3 flex min-h-11 w-full items-center justify-center rounded-lg border py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
    >
      {resendCooldown > 0
        ? `Gửi lại sau ${resendCooldown}s`
        : isSubmitting
          ? "Đang gửi..."
          : "Gửi lại email xác nhận"}
    </button>

    <button
      type="button"
      onClick={onBack}
      className="flex w-full items-center justify-center py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      Đổi email
    </button>
  </div>
);

export default ConfirmStep;
