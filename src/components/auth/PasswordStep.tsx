import { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import PasswordRules from "@/components/auth/PasswordRules";
import type { PasswordRules as Rules } from "@/lib/password-validation";

type PasswordStepProps = {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  isSubmitting: boolean;
  errorMessage: string;
  passwordRules: Rules;
  canSubmit: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onToggleShow: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  submittingLabel?: string;
};

const PasswordStep = ({
  password,
  confirmPassword,
  showPassword,
  isSubmitting,
  errorMessage,
  passwordRules,
  canSubmit,
  onPasswordChange,
  onConfirmChange,
  onToggleShow,
  onSubmit,
  submitLabel = "Hoàn tất đăng ký",
  submittingLabel = "Đang tạo tài khoản...",
}: PasswordStepProps) => (
  <form onSubmit={onSubmit}>
    <div className="mb-3">
      <label
        htmlFor="password"
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        Mật khẩu
      </label>
      <div className="relative">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          className="w-full rounded-lg border bg-background px-4 py-3 pr-10 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>

    <div className="mb-4">
      <PasswordRules rules={passwordRules} />
    </div>

    <div className="mb-4">
      <label
        htmlFor="confirm-password"
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        Xác nhận mật khẩu
      </label>
      <input
        id="confirm-password"
        type={showPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(e) => onConfirmChange(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
        required
        className="w-full rounded-lg border bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
      />
      {confirmPassword && password !== confirmPassword ? (
        <p className="mt-1 text-xs text-destructive">Mật khẩu xác nhận không khớp</p>
      ) : null}
    </div>

    {errorMessage ? (
      <p className="mb-4 text-sm text-destructive" role="alert">
        {errorMessage}
      </p>
    ) : null}

    <button
      type="submit"
      disabled={isSubmitting || !canSubmit}
      className="flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-primary to-primary/80 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isSubmitting ? submittingLabel : submitLabel}
    </button>
  </form>
);

export default PasswordStep;
