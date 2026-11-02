import { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";

type EmailStepProps = {
  email: string;
  agreed: boolean;
  isSubmitting: boolean;
  errorMessage: string;
  lockSeconds: number;
  onEmailChange: (value: string) => void;
  onAgreedChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const EmailStep = ({
  email,
  agreed,
  isSubmitting,
  errorMessage,
  lockSeconds,
  onEmailChange,
  onAgreedChange,
  onSubmit,
}: EmailStepProps) => (
  <form onSubmit={onSubmit}>
    <div className="mb-4">
      <label
        htmlFor="email"
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="jordan.smith@example.com"
        autoComplete="email"
        required
        className="w-full rounded-lg border bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </div>

    <div className="mb-6 flex items-start gap-2">
      <Checkbox
        id="terms"
        checked={agreed}
        onCheckedChange={(v) => onAgreedChange(v === true)}
        className="mt-0.5"
      />
      <label
        htmlFor="terms"
        className="cursor-pointer text-xs leading-relaxed text-muted-foreground"
      >
        Tôi đồng ý{" "}
        <span className="font-semibold text-primary">Điều khoản dịch vụ</span> và{" "}
        <span className="font-semibold text-primary">Chính sách quyền riêng tư</span>.
      </label>
    </div>

    {errorMessage ? (
      <div className="mb-4 text-sm text-destructive" role="alert">
        <p>{errorMessage}</p>
        {errorMessage.includes("đã tồn tại") ||
        errorMessage.includes("EMAIL_EXISTS") ? (
          <p className="mt-2 flex flex-wrap gap-3">
            <Link to="/login" className="font-semibold text-primary underline">
              Đăng nhập
            </Link>
            <Link to="/forgot-password" className="font-semibold text-primary underline">
              Quên mật khẩu
            </Link>
          </p>
        ) : null}
      </div>
    ) : null}

    {lockSeconds > 0 ? (
      <p className="mb-4 text-sm text-muted-foreground">
        Gửi OTP tạm khóa. Thử lại sau {lockSeconds}s.
      </p>
    ) : null}

    <button
      type="submit"
      disabled={isSubmitting || lockSeconds > 0}
      className="flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-primary to-primary/80 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isSubmitting ? "Đang gửi OTP..." : "Gửi mã OTP"}
    </button>
  </form>
);

export default EmailStep;
