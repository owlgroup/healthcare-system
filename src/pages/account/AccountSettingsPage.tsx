import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fetchAccountSettings, upsertAccountSettings } from "@/lib/patient-account-api";
import { changePassword, enrollPatientMfa, verifyPatientMfa } from "@/lib/patient-password-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function formatRelativePasswordDate(iso: string | null): string {
  if (!iso) return "Chưa cập nhật";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Chưa cập nhật";
  const months = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months <= 0) return "Gần đây";
  return `${months} tháng trước`;
}

const AccountSettingsPage = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const settingsKey = ["patient", "account-settings"];

  const { data: settings, isLoading } = useQuery({
    queryKey: settingsKey,
    queryFn: fetchAccountSettings,
  });

  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [testNotifications, setTestNotifications] = useState(true);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaOtp, setMfaOtp] = useState("");
  const [mfaStep, setMfaStep] = useState<"send" | "verify">("send");

  useEffect(() => {
    if (!settings) return;
    setAppointmentReminders(settings.appointment_reminders);
    setTestNotifications(settings.test_result_notifications);
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (patch: { appointment_reminders?: boolean; test_result_notifications?: boolean }) =>
      upsertAccountSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleToggleAppointment = (checked: boolean) => {
    setAppointmentReminders(checked);
    saveSettings.mutate({ appointment_reminders: checked });
  };

  const handleToggleTest = (checked: boolean) => {
    setTestNotifications(checked);
    saveSettings.mutate({ test_result_notifications: checked });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Đã cập nhật mật khẩu");
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể đổi mật khẩu");
    }
  };

  const handleMfaSend = async () => {
    const email = session?.user?.email;
    if (!email) {
      toast.error("Không có email tài khoản");
      return;
    }
    try {
      await enrollPatientMfa(email);
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setMfaStep("verify");
      toast.success("Đã gửi OTP qua email");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể gửi OTP");
    }
  };

  const handleMfaVerify = async () => {
    const email = session?.user?.email;
    if (!email) return;
    try {
      await verifyPatientMfa(email, mfaOtp);
      toast.success("Đã bật xác thực 2 yếu tố");
      setMfaOpen(false);
      setMfaOtp("");
      setMfaStep("send");
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OTP không hợp lệ");
    }
  };

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-foreground">Cài đặt & Bảo mật</h2>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Thông báo</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">Nhắc nhở lịch hẹn</p>
                  <p className="text-sm text-muted-foreground">Nhận tin nhắn SMS và Email trước 24h</p>
                </div>
                <Switch checked={appointmentReminders} onCheckedChange={handleToggleAppointment} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">Kết quả xét nghiệm</p>
                  <p className="text-sm text-muted-foreground">Thông báo qua ứng dụng khi có kết quả mới</p>
                </div>
                <Switch checked={testNotifications} onCheckedChange={handleToggleTest} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 md:p-6">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Bảo mật</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">Đổi mật khẩu</p>
                  <p className="text-sm text-muted-foreground">
                    Cập nhật lần cuối: {formatRelativePasswordDate(settings?.password_updated_at ?? null)}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>Cập nhật</Button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">Xác thực 2 yếu tố</p>
                  <p className="text-sm text-muted-foreground">
                    {settings?.mfa_enabled
                      ? "Đã bật — bảo vệ tài khoản bằng mã OTP qua email"
                      : "Bảo vệ tài khoản bằng mã OTP qua điện thoại/email"}
                  </p>
                </div>
                {!settings?.mfa_enabled ? (
                  <Button type="button" variant="outline" onClick={() => setMfaOpen(true)}>Bật 2FA</Button>
                ) : (
                  <span className="text-sm font-medium text-success">Đã bật</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="current-pw">Mật khẩu hiện tại</Label>
              <Input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-pw">Mật khẩu mới</Label>
              <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="confirm-pw">Xác nhận mật khẩu mới</Label>
              <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>Hủy</Button>
            <Button type="button" onClick={() => void handleChangePassword()}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mfaOpen} onOpenChange={(v) => { setMfaOpen(v); if (!v) { setMfaStep("send"); setMfaOtp(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bật xác thực 2 yếu tố</DialogTitle>
          </DialogHeader>
          {mfaStep === "send" ? (
            <p className="text-sm text-muted-foreground">Chúng tôi sẽ gửi mã OTP 6 số tới email đăng ký của bạn.</p>
          ) : (
            <div>
              <Label htmlFor="mfa-otp">Mã OTP</Label>
              <Input id="mfa-otp" value={mfaOtp} onChange={(e) => setMfaOtp(e.target.value)} maxLength={6} className="mt-2" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMfaOpen(false)}>Hủy</Button>
            {mfaStep === "send" ? (
              <Button type="button" onClick={() => void handleMfaSend()}>Gửi OTP</Button>
            ) : (
              <Button type="button" onClick={() => void handleMfaVerify()}>Xác nhận</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AccountSettingsPage;
