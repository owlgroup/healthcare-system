import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addImmunization } from "@/lib/patient-health-history-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export default function AddImmunizationDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setDate("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên vaccine");
      return;
    }
    setSaving(true);
    try {
      await addImmunization({
        name: name.trim(),
        date: date.trim(),
      });
      toast.success("Đã thêm vaccine");
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể lưu vaccine");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm vaccine</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vax-name">Tên vaccine *</Label>
            <Input id="vax-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Vaccine Cúm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vax-date">Ngày tiêm / tháng năm</Label>
            <Input id="vax-date" value={date} onChange={(e) => setDate(e.target.value)} placeholder="Ví dụ: 10/2023" />
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
