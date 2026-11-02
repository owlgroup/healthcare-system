import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addSurgery } from "@/lib/patient-health-history-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export default function AddSurgeryDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setYear("");
    setNotes("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên phẫu thuật");
      return;
    }
    setSaving(true);
    try {
      await addSurgery({
        name: name.trim(),
        year: year.trim() ? Number(year) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Đã thêm phẫu thuật");
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể lưu phẫu thuật");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm phẫu thuật</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="surgery-name">Tên phẫu thuật / thủ thuật *</Label>
            <Input id="surgery-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="surgery-year">Năm thực hiện</Label>
            <Input id="surgery-year" type="number" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="surgery-notes">Ghi chú</Label>
            <Textarea id="surgery-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
