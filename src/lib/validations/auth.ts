import { z } from "zod";

export const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .transform((v) => v.toLowerCase()),
});

export const otpSchema = z.object({
  email: z.string().email(),
  otp: z
    .string()
    .length(6, "OTP phải là 6 chữ số")
    .regex(/^\d{6}$/, "OTP phải là 6 chữ số"),
});

export const passwordSchema = z.object({
  tempToken: z.string().min(1, "Thiếu temp_token"),
  password: z
    .string()
    .min(8, "Ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Phải có ít nhất 1 chữ hoa")
    .regex(/[0-9]/, "Phải có ít nhất 1 chữ số"),
});

export type EmailFormValues = z.infer<typeof emailSchema>;
export type OtpFormValues = z.infer<typeof otpSchema>;
export type PasswordFormValues = z.infer<typeof passwordSchema>;
