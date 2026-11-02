import { useState, useEffect, useRef } from "react";
import { Check, Loader2, X, Mail, Shield, ShieldCheck, MapPin, Pencil, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { hasPatientRecord, useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import { Button } from "@/components/ui/button";
import { sendProfileOtp, verifyProfileOtp, ProfileOtpError } from "@/lib/profile-otp-api";
import { supabase } from "@/lib/supabase";

type EditableAddress = {
  recipientName: string;
  recipientPhone: string;
  city: string;
  district: string;
  street: string;
  notes: string;
};

const AccountAddressPage = () => {
  const { session } = useAuth();
  const { data: profile, isLoading, isError, error, refetch } = useMyPatientProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(180);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [editData, setEditData] = useState<EditableAddress>({
    recipientName: "",
    recipientPhone: "",
    city: "",
    district: "",
    street: "",
    notes: "",
  });

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const recordExists = hasPatientRecord(profile);
  const waitingForProfile = isLoading && profile === undefined;

  // Get address to parse - prioritize delivery_address, fallback to residential_address
  const getAddressForParsing = () => {
    if (profile?.delivery_address) return profile.delivery_address;
    if (profile?.residential_address) return profile.residential_address;
    return null;
  };

  // Get recipient name - prioritize delivery, fallback to profile
  const getRecipientName = () => {
    if (profile?.delivery_recipient_name) return profile.delivery_recipient_name;
    return profile?.full_name || "";
  };

  // Get recipient phone - prioritize delivery, fallback to profile
  const getRecipientPhone = () => {
    if (profile?.delivery_recipient_phone) return profile.delivery_recipient_phone;
    return profile?.phone_number || "";
  };

  // Parse address for edit form
  // Vietnamese format: "Số nhà + Đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố"
  const parseAddress = () => {
    const fullAddress = getAddressForParsing() || "";
    if (!fullAddress) {
      return { city: "", district: "", street: "" };
    }

    const parts = fullAddress.split(",").map(p => p.trim()).filter(Boolean);
    const len = parts.length;

    if (len === 0) {
      return { city: "", district: "", street: "" };
    } else if (len === 1) {
      return { city: "", district: "", street: parts[0] };
    } else if (len === 2) {
      return { city: parts[1], district: "", street: parts[0] };
    } else if (len === 3) {
      // Format: street, district, city
      return { city: parts[2], district: parts[1], street: parts[0] };
    } else {
      // Format: street, ward, district, city (4+ parts)
      // Last = city, second-to-last = district, third-to-last = ward
      // Everything before = street
      const city = parts[len - 1];
      const district = parts[len - 2];
      const ward = parts[len - 3];
      const street = parts.slice(0, len - 3).join(", ");
      return {
        city,
        district: `${ward}, ${district}`,
        street,
      };
    }
  };

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (isEditing && profile) {
      const { city, district, street } = parseAddress();
      setEditData({
        recipientName: getRecipientName(),
        recipientPhone: getRecipientPhone(),
        city,
        district,
        street,
        notes: profile.delivery_notes || "Giao giờ hành chính, đóng gói kín đáo bảo mật thông tin y tế.",
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

  async function handleEditClick() {
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
      // Build full delivery address
      const fullDeliveryAddress = [editData.street, editData.district, editData.city]
        .filter(Boolean)
        .join(", ");

      const { error } = await supabase
        .from("patient")
        .update({
          delivery_address: fullDeliveryAddress,
          delivery_recipient_name: editData.recipientName,
          delivery_recipient_phone: editData.recipientPhone,
          delivery_notes: editData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Đã lưu địa chỉ thành công!");
      setIsEditing(false);
      refetch();
    } catch (e) {
      console.error("Save error:", e);
      toast.error("Không thể lưu địa chỉ");
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
      setIsEditing(true);
      toast.success("Xác thực thành công! Đã mở chế độ chỉnh sửa.");
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

  // Get display address - prioritize delivery_address, fallback to residential_address from CCCD
  const getDisplayAddress = () => {
    if (profile?.delivery_address) {
      return profile.delivery_address;
    }
    return profile?.residential_address || "Chưa có địa chỉ";
  };

  const getDisplayRecipient = () => {
    if (profile?.delivery_recipient_name) {
      return profile.delivery_recipient_name;
    }
    return getRecipientName() || "—";
  };

  const getDisplayPhone = () => {
    if (profile?.delivery_recipient_phone) {
      return profile.delivery_recipient_phone;
    }
    return getRecipientPhone() || "—";
  };

  const getDisplayNotes = () => {
    return profile?.delivery_notes || "Giao giờ hành chính, đóng gói kín đáo bảo mật thông tin y tế.";
  };

  const isEditLoading = sendingOtp;

  return (
    <section className="space-y-6 mx-auto" style={{ maxWidth: 1168 }}>
      {/* Breadcrumb */}
      <div className="text-sm text-slate-500">Địa chỉ & Giao nhận thuốc</div>

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
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-[22px] font-bold text-slate-800">
                Địa chỉ nhà & Giao nhận thuốc
              </h2>
              <p className="mt-1 text-[15px] text-slate-500">
                Địa chỉ nhận thuốc bảo mật tận nhà cho các đơn thuốc định kỳ.
              </p>
            </div>
            {!isEditing && (
              <Button
                type="button"
                className="h-11 bg-teal-600 px-5 text-[14px] text-white hover:bg-teal-700 disabled:bg-teal-400"
                onClick={handleEditClick}
                disabled={isEditLoading}
              >
                {isEditLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="mr-2 h-4 w-4" />
                )}
                Chỉnh sửa địa chỉ
              </Button>
            )}
          </div>

          {isEditing ? (
            /* Edit Mode */
            <div className="rounded-xl border-2 border-teal-500 bg-white p-6">
              <h3 className="mb-5 flex items-center gap-2 text-[16px] font-bold text-slate-800">
                <MapPin className="h-5 w-5 text-teal-600" />
                Cập nhật địa chỉ nhận thuốc tận nhà
              </h3>

              <div className="space-y-4">
                {/* Row 1: Recipient name & phone */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                      Họ tên người nhận <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.recipientName}
                      onChange={(e) => setEditData({ ...editData, recipientName: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      placeholder="Nhập họ tên người nhận"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                      Số điện thoại nhận thuốc <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={editData.recipientPhone}
                      onChange={(e) => setEditData({ ...editData, recipientPhone: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      placeholder="0912 345 678"
                      required
                    />
                  </div>
                </div>

                {/* Row 2: City & District */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                      Tỉnh / Thành phố <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.city}
                      onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      placeholder="TP. Hồ Chí Minh"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                      Quận / Huyện & Phường / Xã <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.district}
                      onChange={(e) => setEditData({ ...editData, district: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      placeholder="Phường Võ Thị Sáu, Quận 3"
                      required
                    />
                  </div>
                </div>

                {/* Row 3: Street */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                    Số nhà, tên đường chi tiết <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editData.street}
                    onChange={(e) => setEditData({ ...editData, street: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="128 Nguyễn Đình Chiểu"
                    required
                  />
                </div>

                {/* Row 4: Notes */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                    Ghi chú cho đơn vị vận chuyển
                  </label>
                  <input
                    type="text"
                    value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Ghi chú cho shipper..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 px-5 text-[14px]"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    className="h-10 bg-teal-600 px-5 text-[14px] text-white hover:bg-teal-700 disabled:bg-teal-400"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Lưu địa chỉ mới
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-[12px] font-bold text-sky-700">
                  <MapPin className="h-3.5 w-3.5" />
                  Địa chỉ nhận thuốc mặc định
                </span>
                <span className="text-[13px] text-slate-500">
                  Người nhận: <b className="text-slate-800">{getDisplayRecipient()}</b> ({getDisplayPhone()})
                </span>
              </div>

              <div className="mb-2 text-[17px] font-bold text-slate-800">
                {getDisplayAddress()}
              </div>

              <div className="flex items-start gap-1.5 text-[13px] text-slate-500">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Ghi chú: {getDisplayNotes()}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm md:py-16">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <MapPin className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-800">Chưa có dữ liệu</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            Vui lòng tạo hồ sơ bằng AI OCR để tự động trích xuất địa chỉ từ CCCD.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="min-w-[180px] bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                window.location.href = "/ocr-profile";
              }}
            >
              Tạo hồ sơ bằng AI OCR
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
                    Xác thực để chỉnh sửa địa chỉ
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

export default AccountAddressPage;
