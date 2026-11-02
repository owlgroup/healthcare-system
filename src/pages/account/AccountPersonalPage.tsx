import { useState, useEffect, useRef } from "react";
import { Check, Eye, EyeOff, Pencil, Loader2, X, Mail, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { hasPatientRecord, useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import { Button } from "@/components/ui/button";
import { maskEmail, maskDob } from "@/lib/crypto";
import { sendProfileOtp, verifyProfileOtp, ProfileOtpError } from "@/lib/profile-otp-api";
import { supabase } from "@/lib/supabase";

type EditableProfile = {
  preferredName: string;
  fullName: string;
  phone: string;
  email: string;
  dob: string;
  pronouns: string;
};

const AccountPersonalPage = () => {
  const { session } = useAuth();
  const { data: profile, isLoading, isError, error, refetch } = useMyPatientProfile();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<"view" | "edit">("view");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(180);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [editData, setEditData] = useState<EditableProfile>({
    preferredName: "",
    fullName: "",
    phone: "",
    email: "",
    dob: "",
    pronouns: "",
  });

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const recordExists = hasPatientRecord(profile);
  const waitingForProfile = isLoading && profile === undefined;

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (isEditing && profile) {
      setEditData({
        preferredName: profile.legal_first_name || profile.full_name?.split(" ").pop() || "",
        fullName: profile.full_name || "",
        phone: profile.phone_number || "",
        email: profile.email_address || "",
        dob: profile.date_of_birth || "",
        pronouns: profile.preferred_pronouns || "",
      });
    }
  }, [isEditing, profile]);

  // OTP validity timer
  useEffect(() => {
    if (!showOtpModal || otpTimer <= 0) return;
    const timer = setInterval(() => {
      setOtpTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [showOtpModal, otpTimer]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((t) => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  async function handleUnlockForView() {
    if (isUnlocked) return;
    setOtpPurpose("view");
    await handleSendOtp();
  }

  async function handleUnlockForEdit() {
    if (isUnlocked) {
      setIsEditing(true);
      return;
    }
    setOtpPurpose("edit");
    await handleSendOtp();
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  async function handleSaveEdit() {
    if (!profile?.id) {
      toast.error("Không tìm thấy hồ sơ");
      return;
    }

    setIsSaving(true);
    try {
      // Get legal_last_name from first word of fullName (Vietnamese format: Họ + Tên)
      const nameParts = editData.fullName.trim().split(/\s+/);
      const legalLastName = nameParts[0] || "";
      // Use preferredName field for legal_first_name (Tên thường gọi)
      const legalFirstName = editData.preferredName.trim() || nameParts.slice(1).join(" ") || "";

      const { error } = await supabase
        .from("patient")
        .update({
          legal_last_name: legalLastName,
          legal_first_name: legalFirstName,
          phone_number: editData.phone,
          email_address: editData.email,
          date_of_birth: editData.dob || null,
          preferred_pronouns: editData.pronouns,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Đã lưu hồ sơ thành công!");
      setIsEditing(false);
      refetch();
    } catch (e) {
      console.error("Save error:", e);
      toast.error("Không thể lưu hồ sơ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendOtp() {
    const email = session?.user?.email;
    if (!email) {
      toast.error("Không tìm thấy email tài khoản");
      return;
    }

    setSendingOtp(true);
    try {
      const result = await sendProfileOtp(email);
      setOtpTimer(result.expiresIn || 180);
      setResendCooldown(60);
      setOtpCode(["", "", "", "", "", ""]);
      if (!showOtpModal) {
        setShowOtpModal(true);
      }
      toast.success("Đã gửi mã OTP tới email của bạn");
    } catch (e) {
      if (e instanceof ProfileOtpError) {
        if (e.code === "OTP_LOCKED" && e.retryAfterSeconds) {
          toast.error(`Vui lòng chờ ${e.retryAfterSeconds} giây trước khi gửi lại`);
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error("Không thể gửi OTP");
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const email = session?.user?.email;
    if (!email) {
      toast.error("Không tìm thấy email tài khoản");
      return;
    }

    const otp = otpCode.join("");
    if (otp.length !== 6) {
      toast.error("Vui lòng nhập đủ 6 chữ số");
      return;
    }

    setVerifyingOtp(true);
    try {
      await verifyProfileOtp(email, otp);
      setShowOtpModal(false);
      setIsUnlocked(true);

      if (otpPurpose === "edit") {
        setIsEditing(true);
        toast.success("Xác thực thành công! Đã mở chế độ chỉnh sửa.");
      } else {
        toast.success("Xác thực thành công! Đã mở khóa xem đầy đủ.");
      }
    } catch (e) {
      if (e instanceof ProfileOtpError) {
        if (e.code === "OTP_EXPIRED") {
          toast.error("OTP đã hết hạn. Vui lòng gửi lại mã mới.");
        } else if (e.code === "OTP_LOCKED" && e.retryAfterSeconds) {
          toast.error(`Tài khoản tạm khóa. Vui lòng thử lại sau ${Math.ceil(e.retryAfterSeconds / 60)} phút.`);
          setShowOtpModal(false);
        } else if (e.attemptsLeft !== undefined) {
          toast.error(`OTP không đúng. Còn ${e.attemptsLeft} lần thử.`);
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error("Không thể xác thực OTP");
      }
    } finally {
      setVerifyingOtp(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  const getPhoneDisplay = () => {
    if (!profile?.phone_number) return "—";
    if (isUnlocked) return profile.phone_number;
    const phone = profile.phone_number.replace(/\D/g, "");
    if (phone.length < 4) return "••••";
    return `${phone.slice(0, 4)} ••• •••`;
  };

  const getEmailDisplay = () => {
    if (!profile?.email_address) return "—";
    if (isUnlocked) return profile.email_address;
    return maskEmail(profile.email_address);
  };

  const getDobDisplay = () => {
    if (!profile?.date_of_birth) return "—";
    if (isUnlocked) return profile.date_of_birth;
    return maskDob(profile.date_of_birth);
  };

  const isViewLoading = sendingOtp && otpPurpose === "view";
  const isEditLoading = sendingOtp && otpPurpose === "edit";

  return (
    <section className="space-y-6 mx-auto" style={{ maxWidth: 1168 }}>
      {/* Breadcrumb */}
      <div className="text-sm text-slate-500">Hồ sơ cá nhân</div>

      {waitingForProfile ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm font-semibold text-red-600">Không tải được hồ sơ</p>
          <p className="mt-1 text-sm text-slate-500">
            {error instanceof Error ? error.message : "Lỗi không xác định"}
          </p>
        </div>
      ) : recordExists ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-slate-800">
              Hồ sơ cá nhân & Thông tin liên hệ
            </h2>
            <p className="mt-2 text-[17px] text-slate-500">
              Thông tin định danh và liên lạc của bệnh nhân trên hệ thống phòng khám.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mb-10 flex flex-wrap items-center gap-4">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border-slate-300 px-6 text-[15px] text-slate-700 hover:bg-slate-50"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="mr-2.5 h-[18px] w-[18px]" />
                  Hủy
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-teal-600 px-6 text-[15px] text-white hover:bg-teal-700 disabled:bg-teal-400"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2.5 h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <Check className="mr-2.5 h-[18px] w-[18px]" />
                  )}
                  Lưu hồ sơ
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border-slate-300 px-6 text-[15px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleUnlockForView}
                  disabled={sendingOtp || isUnlocked}
                >
                  {isViewLoading ? (
                    <Loader2 className="mr-2.5 h-[18px] w-[18px] animate-spin" />
                  ) : isUnlocked ? (
                    <Eye className="mr-2.5 h-[18px] w-[18px] text-emerald-600" />
                  ) : (
                    <EyeOff className="mr-2.5 h-[18px] w-[18px]" />
                  )}
                  {isUnlocked ? "Đã mở khóa" : "Mở khóa xem đầy đủ (Gửi OTP Email)"}
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-teal-600 px-6 text-[15px] text-white hover:bg-teal-700 disabled:bg-teal-400"
                  onClick={handleUnlockForEdit}
                  disabled={isEditLoading}
                >
                  {isEditLoading ? (
                    <Loader2 className="mr-2.5 h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <Pencil className="mr-2.5 h-[18px] w-[18px]" />
                  )}
                  Chỉnh sửa hồ sơ
                </Button>
              </>
            )}
          </div>

          {/* Profile Fields Grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Tên thường gọi */}
            <div className={`rounded-xl border px-6 py-6 ${isEditing ? "border-teal-300 bg-white" : "border-slate-200 bg-slate-50/30"}`}>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                Tên thường gọi
              </p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.preferredName}
                  onChange={(e) => setEditData({ ...editData, preferredName: e.target.value })}
                  className="mt-2 w-full border-none bg-transparent p-0 text-xl font-bold text-slate-800 outline-none focus:ring-0"
                  placeholder="Nhập tên thường gọi"
                />
              ) : (
                <p className="mt-3 text-xl font-bold text-slate-800">
                  {profile.legal_first_name || profile.full_name?.split(" ").pop() || "—"}
                </p>
              )}
            </div>

            {/* Họ và tên đầy đủ */}
            <div className={`rounded-xl border px-6 py-6 ${isEditing ? "border-teal-300 bg-white" : "border-slate-200 bg-slate-50/30"}`}>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                Họ và tên đầy đủ
              </p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.fullName}
                  onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                  className="mt-2 w-full border-none bg-transparent p-0 text-xl font-bold text-slate-800 outline-none focus:ring-0"
                  placeholder="Nhập họ và tên đầy đủ"
                />
              ) : (
                <p className="mt-3 text-xl font-bold text-slate-800">
                  {profile.full_name || "—"}
                </p>
              )}
            </div>

            {/* Số điện thoại */}
            <div className={`rounded-xl border px-6 py-6 ${isEditing ? "border-teal-300 bg-white" : "border-slate-200 bg-slate-50/30"}`}>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                Số điện thoại
              </p>
              {isEditing ? (
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="mt-2 w-full border-none bg-transparent p-0 text-xl font-bold text-slate-800 outline-none focus:ring-0"
                  placeholder="Nhập số điện thoại"
                />
              ) : (
                <p className="mt-3 text-xl font-bold text-slate-800">
                  {getPhoneDisplay()}
                </p>
              )}
            </div>

            {/* Địa chỉ Email */}
            <div className={`rounded-xl border px-6 py-6 ${isEditing ? "border-teal-300 bg-white" : "border-slate-200 bg-slate-50/30"}`}>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                Địa chỉ Email
              </p>
              {isEditing ? (
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="mt-2 w-full border-none bg-transparent p-0 text-xl font-bold text-slate-800 outline-none focus:ring-0"
                  placeholder="Nhập địa chỉ email"
                />
              ) : (
                <p className="mt-3 text-xl font-bold text-slate-800">
                  {getEmailDisplay()}
                </p>
              )}
            </div>

            {/* Ngày sinh */}
            <div className={`rounded-xl border px-6 py-6 ${isEditing ? "border-teal-300 bg-white" : "border-slate-200 bg-slate-50/30"}`}>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                Ngày sinh
              </p>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.dob}
                  onChange={(e) => setEditData({ ...editData, dob: e.target.value })}
                  className="mt-2 w-full border-none bg-transparent p-0 text-xl font-bold text-slate-800 outline-none focus:ring-0"
                />
              ) : (
                <p className="mt-3 text-xl font-bold text-slate-800">
                  {getDobDisplay()}
                </p>
              )}
            </div>

            {/* Đại từ xưng hô */}
            <div className={`rounded-xl border px-6 py-6 ${isEditing ? "border-teal-300 bg-white" : "border-slate-200 bg-slate-50/30"}`}>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                Đại từ xưng hô
              </p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.pronouns}
                  onChange={(e) => setEditData({ ...editData, pronouns: e.target.value })}
                  className="mt-2 w-full border-none bg-transparent p-0 text-xl font-bold text-slate-800 outline-none focus:ring-0"
                  placeholder="Ví dụ: Anh/Nam, Chị/Nữ"
                />
              ) : (
                <p className="mt-3 text-xl font-bold text-slate-800">
                  {profile.preferred_pronouns || "—"}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm md:py-16">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Eye className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-800">Chưa có dữ liệu</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            Vui lòng tạo hồ sơ để xem thông tin cá nhân của bạn.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="min-w-[160px] bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                toast.info("Tính năng đang phát triển", {
                  description: "Chức năng tạo hồ sơ sẽ sớm được cập nhật.",
                });
              }}
            >
              Tạo hồ sơ
            </Button>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-[440px] rounded-[18px] bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
                  <Shield className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-slate-800">Xác thực bảo mật OTP</h3>
                  <p className="text-[13px] text-slate-500">
                    {otpPurpose === "edit" ? "Xác thực để chỉnh sửa hồ sơ" : "Bảo vệ dữ liệu cá nhân"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Mail className="h-7 w-7 text-slate-600" />
              </div>
              <p className="mb-1 text-[15px] text-slate-700">Nhập mã OTP xác thực email</p>
              <p className="text-[13px] text-slate-500">
                Mã xác thực gồm 6 chữ số đã được gửi tự động đến hộp thư:
              </p>
              <p className="mt-1 text-[14px] font-bold text-slate-800">{session?.user?.email}</p>
            </div>

            <div className="mb-4">
              <div className="mb-3 text-center text-[12px] font-bold uppercase tracking-wide text-slate-500">
                Mã xác thực 6 chữ số
              </div>
              <div className="flex justify-center gap-2">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="h-14 w-12 rounded-lg border-2 border-slate-200 text-center text-[24px] font-bold transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                ))}
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <div className="text-[14px] text-slate-600">
                Hiệu lực trong:{" "}
                <span className={`font-bold ${otpTimer < 60 ? "text-red-500" : "text-teal-600"}`}>
                  {formatTimer(otpTimer)}
                </span>
              </div>
              <button
                onClick={handleSendOtp}
                disabled={resendCooldown > 0 || sendingOtp}
                className="cursor-pointer text-[14px] font-semibold text-teal-600 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : "Gửi lại mã"}
              </button>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={() => setShowOtpModal(false)}
                className="h-[56px] flex-1 cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-6 text-[15px] font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                Hủy
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpCode.some((d) => !d)}
                className="inline-flex h-[56px] flex-[1.4] cursor-pointer items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-6 font-bold text-white shadow-lg shadow-teal-600/25 transition-all hover:from-teal-700 hover:to-teal-600 hover:shadow-teal-600/40 active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
              >
                {verifyingOtp ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[14px]">Xác nhận &</span>
                  <span className="text-[15px]">Mở khóa</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AccountPersonalPage;
