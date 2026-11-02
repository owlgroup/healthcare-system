import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMedication } from "@/lib/patient-health-history-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export default function AddMedicationDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [refills, setRefills] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setDose("");
    setFrequency("");
    setPharmacy("");
    setRefills("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên thuốc");
      return;
    }
    setSaving(true);
    try {
      await addMedication({
        name: name.trim(),
        dose: dose.trim(),
        frequency: frequency.trim(),
        pharmacy: pharmacy.trim() || undefined,
        refills_remaining: refills.trim() ? Number(refills) : undefined,
      });
      toast.success("Đã thêm thuốc");
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể lưu thuốc");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm thuốc đang dùng</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="med-name">Tên thuốc *</Label>
            <Input id="med-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="med-dose">Liều lượng</Label>
              <Input id="med-dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="200mg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-freq">Tần suất</Label>
              <Input id="med-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Hàng ngày" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="med-pharmacy">Nhà thuốc</Label>
              <Input id="med-pharmacy" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-refills">Số lần còn lại</Label>
              <Input id="med-refills" type="number" min={0} value={refills} onChange={(e) => setRefills(e.target.value)} />
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
