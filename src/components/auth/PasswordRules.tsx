import type { PasswordRules as Rules } from "@/lib/password-validation";

type PasswordRulesProps = {
  rules: Rules;
};

const PasswordRules = ({ rules }: PasswordRulesProps) => (
  <ul className="space-y-1 text-xs" aria-live="polite">
    <li className={rules.minLength ? "text-success" : "text-muted-foreground"}>
      {rules.minLength ? "✓" : "○"} Ít nhất 8 ký tự
    </li>
    <li className={rules.hasUppercase ? "text-success" : "text-muted-foreground"}>
      {rules.hasUppercase ? "✓" : "○"} Có chữ hoa (A–Z)
    </li>
    <li className={rules.hasDigit ? "text-success" : "text-muted-foreground"}>
      {rules.hasDigit ? "✓" : "○"} Có chữ số (0–9)
    </li>
  </ul>
);

export default PasswordRules;
