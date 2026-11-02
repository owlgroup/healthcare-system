export type PasswordRules = {
  valid: boolean;
  minLength: boolean;
  hasUppercase: boolean;
  hasDigit: boolean;
};

export function validatePasswordRules(password: string): PasswordRules {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return {
    valid: minLength && hasUppercase && hasDigit,
    minLength,
    hasUppercase,
    hasDigit,
  };
}
