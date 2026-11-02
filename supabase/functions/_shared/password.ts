export type PasswordValidation = {
  valid: boolean;
  minLength: boolean;
  hasUppercase: boolean;
  hasDigit: boolean;
};

export function validatePassword(password: string): PasswordValidation {
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
