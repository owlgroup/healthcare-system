import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accessibility, Loader2, Phone, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  createEmergencyContact,
  deleteEmergencyContact,
  fetchAccessibilityPreferences,
  fetchCareTeam,
  fetchEmergencyContacts,
  updateEmergencyContact,
  upsertAccessibilityPreferences,
  type EmergencyContactInput,
} from "@/lib/patient-account-api";
import type { EmergencyContact } from "@/types/patient-account";
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
import { sanitizeSensitiveDisplay, sanitizeSensitiveInput } from "@/lib/crypto";

function ContactDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: EmergencyContact | null;
  onSave: (input: EmergencyContactInput) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(sanitizeSensitiveInput(initial?.full_name));
  const [relationship, setRelationship] = useState(sanitizeSensitiveInput(initial?.relationship));
  const [phone, setPhone] = useState(sanitizeSensitiveInput(initial?.phone_number));
  const [saving, setSaving] = useState(false);

  const handleOpen = (v: boolean) => {
    if (v) {
      setFullName(sanitizeSensitiveInput(initial?.full_name));
      setRelationship(sanitizeSensitiveInput(initial?.relationship));
      setPhone(sanitizeSensitiveInput(initial?.phone_number));
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Vui lòng nhập họ tên và số điện thoại");
      return;
    }
    setSaving(true);
    try {
      await onSave({ full_name: fullName, relationship, phone_number: phone });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Sửa liên hệ" : "Thêm liên hệ khẩn cấp"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="contact-name">Họ và tên</Label>
            <Input id="contact-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="contact-rel">Mối quan hệ</Label>
            <Input id="contact-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Bố, Mẹ, Vợ/Chồng…" />
          </div>
          <div>
            <Label htmlFor="contact-phone">Số điện thoại</Label>
            <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const AccountMedicalSupportPage = () => {
  const queryClient = useQueryClient();
  const contactsKey = ["patient", "emergency-contacts"];
  const accessibilityKey = ["patient", "accessibility"];
  const careTeamKey = ["patient", "care-team"];

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: contactsKey,
    queryFn: fetchEmergencyContacts,
  });

  const { data: careTeam = [], isLoading: careLoading } = useQuery({
    queryKey: careTeamKey,
    queryFn: fetchCareTeam,
  });

  const { data: accessibility, isLoading: a11yLoading } = useQuery({
    queryKey: accessibilityKey,
    queryFn: fetchAccessibilityPreferences,
  });

  const [lang, setLang] = useState("");
  const [interpreter, setInterpreter] = useState("");
  const [mobility, setMobility] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!accessibility) return;
    setLang(accessibility.communication_language ?? "");
    setInterpreter(accessibility.interpreter_needed ?? "");
    setMobility(accessibility.mobility_support ?? "");
    setNotes(accessibility.additional_notes ?? "");
  }, [accessibility]);

  const saveAccessibility = useMutation({
    mutationFn: () => upsertAccessibilityPreferences({
      communication_language: lang || null,
      interpreter_needed: interpreter || null,
      mobility_support: mobility || null,
      additional_notes: notes || null,
    }),
    onSuccess: () => {
      toast.success("Đã lưu yêu cầu hỗ trợ");
      void queryClient.invalidateQueries({ queryKey: accessibilityKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveContact = async (input: EmergencyContactInput) => {
    if (editingContact) {
      await updateEmergencyContact(editingContact.id, input);
      toast.success("Đã cập nhật liên hệ");
    } else {
      await createEmergencyContact(input);
      toast.success("Đã thêm liên hệ");
    }
    void queryClient.invalidateQueries({ queryKey: contactsKey });
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await deleteEmergencyContact(id);
      toast.success("Đã xóa liên hệ");
      void queryClient.invalidateQueries({ queryKey: contactsKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể xóa");
    }
  };

  const loading = contactsLoading || careLoading || a11yLoading;

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Hỗ trợ Y tế & Liên hệ</h2>
        <Button
          type="button"
          className="gap-2"
          onClick={() => {
            setEditingContact(null);
            setContactDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm liên hệ
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Liên hệ khẩn cấp</h3>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có liên hệ khẩn cấp.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Họ và tên</th>
                      <th className="pb-2 font-medium">Mối quan hệ</th>
                      <th className="pb-2 font-medium">Số điện thoại</th>
                      <th className="pb-2 font-medium">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">{sanitizeSensitiveDisplay(c.full_name)}</td>
                        <td className="py-3">{sanitizeSensitiveDisplay(c.relationship)}</td>
                        <td className="py-3">{sanitizeSensitiveDisplay(c.phone_number)}</td>
                        <td className="py-3">
                          <button
                            type="button"
                            className="mr-3 text-primary hover:underline"
                            onClick={() => {
                              setEditingContact(c);
                              setContactDialogOpen(true);
                            }}
                          >
                            Sửa
                          </button>
                          <button type="button" className="text-destructive hover:underline" onClick={() => void handleDeleteContact(c.id)}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-5 w-5 text-success" />
              <h3 className="font-semibold text-foreground">Đội ngũ chăm sóc chính</h3>
            </div>
            {careTeam.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bác sĩ từ lịch hẹn gần đây.</p>
            ) : (
              careTeam.map((doc) => (
                <div key={doc.doctor_id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">BS</div>
                    <div>
                      <p className="font-semibold">{doc.doctor_name}</p>
                      <p className="text-sm text-muted-foreground">{doc.specialty ?? "Bác sĩ đa khoa"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm"><Link to="/messages">Nhắn tin</Link></Button>
                    <Button asChild variant="outline" size="sm" className="border-primary text-primary"><Link to="/appointments/book">Đặt hẹn</Link></Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Accessibility className="h-5 w-5 text-warning" />
              <h3 className="font-semibold text-foreground">Yêu cầu hỗ trợ đặc biệt</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-4">
                <Label htmlFor="a11y-lang">Ngôn ngữ giao tiếp</Label>
                <Input id="a11y-lang" className="mt-2" value={lang} onChange={(e) => setLang(e.target.value)} placeholder="Tiếng Việt" />
                <Input className="mt-2" value={interpreter} onChange={(e) => setInterpreter(e.target.value)} placeholder="Cần phiên dịch viên…" />
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <Label htmlFor="a11y-mobility">Hỗ trợ di chuyển</Label>
                <Input id="a11y-mobility" className="mt-2" value={mobility} onChange={(e) => setMobility(e.target.value)} placeholder="Sử dụng xe lăn…" />
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 md:col-span-2">
                <Label htmlFor="a11y-notes">Ghi chú thêm</Label>
                <textarea
                  id="a11y-notes"
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <Button type="button" className="mt-4" onClick={() => saveAccessibility.mutate()} disabled={saveAccessibility.isPending}>
              Lưu yêu cầu hỗ trợ
            </Button>
          </div>
        </>
      )}

      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        initial={editingContact}
        onSave={handleSaveContact}
      />
    </section>
  );
};

export default AccountMedicalSupportPage;
