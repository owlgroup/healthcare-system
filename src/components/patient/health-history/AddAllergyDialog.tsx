import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addAllergy } from "@/lib/patient-health-history-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export default function AddAllergyDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("");
  const [reaction, setReaction] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setSeverity("");
    setReaction("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên dị ứng");
      return;
    }
    setSaving(true);
    try {
      await addAllergy({
        name: name.trim(),
        severity: severity.trim() || undefined,
        reaction: reaction.trim(),
      });
      toast.success("Đã thêm dị ứng");
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể lưu dị ứng");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm dị ứng mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allergy-name">Tên dị ứng *</Label>
            <Input id="allergy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Penicillin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergy-severity">Mức độ</Label>
            <Input id="allergy-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="Ví dụ: Phản ứng nặng" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergy-reaction">Triệu chứng / phản ứng</Label>
            <Input id="allergy-reaction" value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="Ví dụ: Nổi mề đay, phù" />
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
