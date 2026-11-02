import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateProfileSummary } from "@/lib/patient-health-history-api";
import {
  BLOOD_TYPE_OPTIONS, LANGUAGE_LABELS, type PatientHealthHistory,
} from "@/types/patient-health-history";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  chart: PatientHealthHistory | null;
};

export default function EditProfileSummaryDialog({ open, onOpenChange, onSuccess, chart }: Props) {
  const [bloodType, setBloodType] = useState("");
  const [language, setLanguage] = useState("vi");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!chart) return;
    setBloodType(chart.blood_type ?? "");
    setLanguage(chart.preferred_language || "vi");
    setContactName(chart.emergency_contact_name ?? "");
    setContactPhone(chart.emergency_contact_phone ?? "");
  }, [chart, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfileSummary({
        blood_type: bloodType.trim() || null,
        preferred_language: language,
        emergency_contact_name: contactName.trim() || null,
        emergency_contact_phone: contactPhone.trim() || null,
      });
      toast.success("Đã cập nhật hồ sơ");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể cập nhật hồ sơ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật tóm tắt hồ sơ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nhóm máu</Label>
            <Select value={bloodType || "__none__"} onValueChange={(v) => setBloodType(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn nhóm máu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Chưa xác định</SelectItem>
                {BLOOD_TYPE_OPTIONS.map((bt) => (
                  <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ngôn ngữ ưa thích</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                  <SelectItem key={code} value={code}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-name">Liên hệ khẩn cấp</Label>
            <Input id="ec-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Họ tên" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-phone">Số điện thoại khẩn cấp</Label>
            <Input id="ec-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="090..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Hủy</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
