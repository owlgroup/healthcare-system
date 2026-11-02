import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCondition } from "@/lib/patient-health-history-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export default function AddConditionDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("Đang kiểm soát");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setYear("");
    setStatus("Đang kiểm soát");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên bệnh lý");
      return;
    }
    setSaving(true);
    try {
      await addCondition({
        name: name.trim(),
        diagnosed_year: year.trim() ? Number(year) : undefined,
        status: status.trim() || undefined,
      });
      toast.success("Đã thêm bệnh lý");
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể lưu bệnh lý");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm bệnh lý</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cond-name">Tên bệnh lý *</Label>
            <Input id="cond-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cond-year">Năm chẩn đoán</Label>
              <Input id="cond-year" type="number" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cond-status">Trạng thái</Label>
              <Input id="cond-status" value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>
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
