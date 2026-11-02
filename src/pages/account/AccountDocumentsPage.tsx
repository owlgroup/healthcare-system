import { useState, useEffect, useRef } from "react";
import { CheckCircle, Eye, EyeOff, Loader2, Lock, Mail, QrCode, Shield, ShieldCheck, Sparkles, User, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { hasPatientRecord, useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import { Button } from "@/components/ui/button";
import { sendProfileOtp, verifyProfileOtp, ProfileOtpError } from "@/lib/profile-otp-api";

function maskString(str: string, showFirst = 3, showLast = 3): string {
  if (!str || str.length <= showFirst + showLast) return str;
  const first = str.slice(0, showFirst);
  const last = str.slice(-showLast);
  const middle = " ••• ••• ";
  return `${first}${middle}${last}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN");
}

const AccountDocumentsPage = () => {
  const { session } = useAuth();
  const { data: profile, isLoading, isError, error } = useMyPatientProfile();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(180);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const recordExists = hasPatientRecord(profile);
  const waitingForProfile = isLoading && profile === undefined;

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

  async function handleUnlock() {
    if (isUnlocked) return;
    await handleSendOtp();
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
      toast.success("Xác thực thành công! Đã mở khóa xem đầy đủ.");
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

  const getCccdDisplay = () => {
    if (!profile?.id_number) return "—";
    if (isUnlocked) return profile.id_number;
    return maskString(profile.id_number);
  };

  const getAddressDisplay = () => {
    if (!profile?.residential_address) return "—";
    if (isUnlocked) return profile.residential_address;
    return "••••••••••••••••••••••••••••••••••••••••";
  };

  const hasEkyc = Boolean(profile?.id_number);

  return (
    <section className="space-y-6 mx-auto" style={{ maxWidth: 1168 }}>
      {/* Breadcrumb */}
      <div className="text-sm text-slate-500">Căn cước công dân & Giấy tờ định danh</div>

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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 border-b border-slate-200 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[24px] font-bold text-slate-800">
                  Căn Cước Công Dân Gắn Chip (CCCD)
                </h2>
                <p className="mt-1 text-[15px] text-slate-500">
                  Hồ sơ định danh điện tử của bệnh nhân đã được xác thực eKYC và dữ liệu được trích xuất tự động qua AI OCR (Dữ liệu định danh bất biến).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 border-slate-300 px-5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={handleUnlock}
                disabled={sendingOtp || isUnlocked}
              >
                {sendingOtp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isUnlocked ? (
                  <Eye className="h-4 w-4 text-emerald-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-sky-600" />
                )}
                {isUnlocked ? "Đã mở khóa" : "Mở khóa xem đầy đủ (Gửi OTP Email)"}
              </Button>
            </div>
          </div>

          {/* CCCD Cards */}
          <div className="mb-5 grid gap-5 md:grid-cols-2">
            {/* Mặt trước */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                Mặt trước CCCD gắn chip
              </div>
              <div className="rounded-xl bg-gradient-to-br from-sky-50 to-teal-50 p-4 shadow-sm">
                <div className="mb-3 text-[9px] font-extrabold text-sky-700">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-12 flex-shrink-0 items-center justify-center rounded bg-slate-400 text-white">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">Số / No.:</div>
                    <div className="text-[14px] font-black tracking-wider text-slate-800">
                      {getCccdDisplay()}
                    </div>
                    <div className="text-[12px] font-bold text-slate-800">
                      {profile.full_name || "—"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {formatDate(profile.date_of_birth)} · {profile.preferred_pronouns?.includes("Nam") ? "Nam" : profile.preferred_pronouns?.includes("Nữ") ? "Nữ" : "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div className="h-5 w-8 rounded-sm bg-gradient-to-br from-amber-300 to-amber-500"></div>
                  <div className="text-[9px] text-slate-500">
                    Hạn đến: {formatDate(profile.id_expiration_date)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mặt sau */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                Mặt sau CCCD gắn chip
              </div>
              <div className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 p-4 shadow-sm">
                <div className="mb-2 text-[9px] text-slate-600">
                  Đặc điểm: Nốt ruồi c.1cm dưới sau mép phải<br />
                  Ngày cấp: {formatDate(profile.id_issued_date)}
                </div>
                <div className="mb-3 rounded bg-black/5 px-2 py-1.5 font-mono text-[8px] tracking-wide text-slate-700">
                  IDVNM0790940045664&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;<br />
                  9403208M3403208VNM&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;8
                </div>
                <div className="flex justify-end">
                  <QrCode className="h-6 w-6 text-slate-800" />
                </div>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div className="mb-6 flex flex-wrap gap-3">
            {hasEkyc && (
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                <div>
                  <div className="text-[14px] font-bold text-emerald-700">
                    Trạng thái: ĐÃ XÁC THỰC eKYC HỢP LỆ
                  </div>
                  <div className="text-[12px] text-emerald-600">
                    Xác thực lần đầu: {formatDate(profile.id_issued_date)} · ID hợp lệ tới {formatDate(profile.id_expiration_date)} (Dữ liệu cố định)
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-blue-50 px-5 py-3.5">
              <Sparkles className="h-5 w-5 flex-shrink-0 text-sky-600" />
              <div>
                <div className="text-[13px] font-bold text-sky-700">Hồ sơ tạo từ AI OCR</div>
                <div className="text-[11px] text-sky-600">Dữ liệu trích xuất tự động từ ảnh CCCD</div>
              </div>
            </div>
          </div>

          {/* Info Fields */}
          <div className="space-y-3.5">
            {/* Row 1: CCCD + Full name */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Số CCCD / Định danh
                  </span>
                  {!isUnlocked && <Lock className="h-3 w-3 text-slate-400" />}
                </div>
                <div className="mt-1 text-[15px] font-extrabold tracking-wider text-slate-800">
                  {getCccdDisplay()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Họ và tên đầy đủ
                </span>
                <div className="mt-1 text-[15px] font-bold text-slate-800">
                  {profile.full_name || "—"}
                </div>
              </div>
            </div>

            {/* Row 2: DOB + Gender */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Ngày sinh
                </span>
                <div className="mt-1 text-[15px] font-semibold text-slate-800">
                  {formatDate(profile.date_of_birth)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Giới tính
                </span>
                <div className="mt-1 text-[15px] font-semibold text-slate-800">
                  {profile.preferred_pronouns?.includes("Nam") ? "Nam" : profile.preferred_pronouns?.includes("Nữ") ? "Nữ" : "—"}
                </div>
              </div>
            </div>

            {/* Row 3: Address */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Nơi đăng ký thường trú
                </span>
                {!isUnlocked && <Lock className="h-3 w-3 text-slate-400" />}
              </div>
              <div className="mt-1 text-[15px] font-semibold tracking-wide text-slate-800">
                {getAddressDisplay()}
              </div>
            </div>

            {/* Row 4: Issue date + Expiry */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Ngày cấp
                </span>
                <div className="mt-1 text-[15px] font-semibold text-slate-800">
                  {formatDate(profile.id_issued_date)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Hạn sử dụng
                </span>
                <div className="mt-1 text-[15px] font-semibold text-slate-800">
                  {formatDate(profile.id_expiration_date)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm md:py-16">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Eye className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-800">Chưa có dữ liệu CCCD</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            Vui lòng tạo hồ sơ và tải lên ảnh CCCD để hệ thống tự động trích xuất thông tin.
          </p>
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
                  <p className="text-[13px] text-slate-500">Bảo vệ dữ liệu Căn Cước Công Dân</p>
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

export default AccountDocumentsPage;
