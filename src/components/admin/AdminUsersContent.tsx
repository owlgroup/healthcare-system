import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, UserPlus, Search, Pencil, RotateCcw, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminApiError,
  type AdminRoleRow,
  type AdminUserRow,
  type AdminUserStatus,
  type FacilityRow,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  listFacilities,
  listAdminRoles,
  resetAdminUserPassword,
  updateAdminUser,
} from "@/lib/admin-api";
import { fetchSpecialties } from "@/lib/appointment-api";
import type { Specialty } from "@/types/appointment";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const statusLabel: Record<AdminUserStatus, string> = {
  active: "Hoạt động",
  inactive: "Ngưng",
  locked: "Khóa",
};

const statusStyle: Record<AdminUserStatus, string> = {
  active: "bg-success/10 text-success",
  inactive: "bg-muted text-muted-foreground",
  locked: "bg-destructive/10 text-destructive",
};

/** Màu badge vai trò / avatar theo portal của vai trò (vai trò tùy chỉnh dùng màu tím). */
const roleTone = (user: AdminUserRow) => {
  const portal = user.roles?.portal_role ?? user.role;
  if (portal === "admin") return "bg-primary/10 text-primary";
  if (portal === "doctor") return "bg-blue-50 text-blue-700";
  if (portal === "patient") return "bg-green-50 text-green-700";
  return "bg-violet-50 text-violet-700";
};

const initials = (name: string | null, email: string) => {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return email.charAt(0).toUpperCase();
  const last = words[words.length - 1].charAt(0);
  const prev = words.length > 1 ? words[words.length - 2].charAt(0) : "";
  return (prev + last).toUpperCase();
};

type UserForm = {
  fullName: string;
  email: string;
  phone: string;
  roleId: string;
  facilityId: string;
  specialty: string;
  status: AdminUserStatus;
};

const emptyForm = (): UserForm => ({
  fullName: "",
  email: "",
  phone: "",
  roleId: "",
  facilityId: "",
  specialty: "",
  status: "active",
});

const AdminUsersContent = () => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<AdminRoleRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());

  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdSignPin, setCreatedSignPin] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === form.roleId),
    [roles, form.roleId],
  );
  const isDoctor = selectedRole?.portal_role === "doctor" || selectedRole?.slug === "doctor";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, facRes, specsRes] = await Promise.all([
        listAdminUsers({ search: search || undefined, page, limit: 20 }),
        listAdminRoles(),
        listFacilities(),
        fetchSpecialties(),
      ]);
      setUsers(usersRes.users);
      setTotal(usersRes.total);
      setRoles(rolesRes.roles);
      setFacilities(facRes.facilities);
      setSpecialties(specsRes);
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : "Không tải được dữ liệu";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (user: AdminUserRow) => {
    setEditing(user);
    setForm({
      fullName: user.full_name ?? "",
      email: user.email,
      phone: user.phone ?? "",
      roleId: user.role_id ?? "",
      facilityId: user.facility_id ?? "",
      specialty: user.specialty ?? "",
      status: user.status,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.roleId) {
      toast.error("Vui lòng nhập tên và chọn vai trò");
      return;
    }
    if (!editing && !form.email.trim()) {
      toast.error("Vui lòng nhập email");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await updateAdminUser({
          userId: editing.user_id,
          fullName: form.fullName,
          phone: form.phone,
          roleId: form.roleId,
          facilityId: form.facilityId || null,
          specialty: isDoctor ? form.specialty : null,
          status: form.status,
        });
        toast.success(res.message ?? "Cập nhật thành công");
      } else {
        const res = await createAdminUser({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          roleId: form.roleId,
          facilityId: form.facilityId || null,
          specialty: isDoctor ? form.specialty : null,
          status: form.status,
        });
        setTempPassword(res.tempPassword);
        if (res.signPin) setCreatedSignPin(res.signPin);
        toast.success(res.message);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof AdminApiError ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (user: AdminUserRow) => {
    try {
      const res = await resetAdminUserPassword(user.user_id);
      setTempPassword(res.tempPassword);
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof AdminApiError ? err.message : "Reset thất bại");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAdminUser(deleteTarget.user_id);
      toast.success("Đã xóa người dùng");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof AdminApiError ? err.message : "Xóa thất bại");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  // API chưa hỗ trợ lọc theo vai trò nên lọc trên trang hiện tại.
  const visibleUsers = useMemo(
    () => (roleFilter === "all" ? users : users.filter((u) => u.role_id === roleFilter)),
    [users, roleFilter],
  );

  const roleChips = [{ id: "all", name: "Tất cả" }, ...roles.map((r) => ({ id: r.id, name: r.name }))];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <span className="text-muted-foreground">Tổ chức</span>
            <span className="text-muted-foreground">›</span>
            <span className="text-primary">Người dùng</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground">Tài khoản truy cập hệ thống theo vai trò và cơ sở.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <UserPlus className="h-4 w-4" />
          Thêm người dùng
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col gap-3 p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên, email, SĐT..."
              className="pl-10 bg-muted/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {roleChips.map((chip) => {
              const active = roleFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setRoleFilter(chip.id)}
                  aria-pressed={active}
                  className={`h-8 px-3 rounded-full border text-sm transition-colors duration-200 cursor-pointer ${
                    active
                      ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                      : "border-border bg-card text-foreground hover:bg-muted/50"
                  }`}
                >
                  {chip.name}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải...
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mb-2 opacity-40" />
            <p>{users.length === 0 ? "Chưa có người dùng" : "Không tìm thấy người dùng."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Người dùng</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vai trò</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cơ sở</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Trạng thái</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const tone = roleTone(user);
                  return (
                    <tr key={user.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`h-9 w-9 shrink-0 rounded-full grid place-items-center text-xs font-bold ${tone}`}>
                            {initials(user.full_name, user.email)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{user.full_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            {user.specialty && (
                              <p className="text-xs text-primary">Chuyên khoa: {user.specialty}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>
                          {user.roles?.name ?? user.role}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${user.facilities?.name ? "text-foreground" : "text-muted-foreground"}`}>
                        {user.facilities?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[user.status]}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusLabel[user.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(user)} title="Sửa" aria-label="Sửa">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleResetPassword(user)} title="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTarget(user)} title="Xóa" aria-label="Xóa">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t">
          <p className="text-sm text-muted-foreground">
            Tổng <span className="font-semibold text-foreground">{total}</span> người dùng
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </Button>
            <span className="text-sm self-center">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Sau
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa người dùng" : "Thêm người dùng mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="fullName">Họ tên</Label>
              <Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            {!editing && (
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            )}
            <div>
              <Label htmlFor="phone">SĐT</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Vai trò</Label>
              <Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn vai trò" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}{r.is_system ? " (hệ thống)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cơ sở</Label>
              <Select value={form.facilityId || "__none__"} onValueChange={(v) => setForm({ ...form, facilityId: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Chọn cơ sở" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Không —</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isDoctor && (
              <div>
                <Label>Chuyên khoa (Doctor)</Label>
                <Select
                  value={form.specialty || "__none__"}
                  onValueChange={(v) => setForm({ ...form, specialty: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn chuyên khoa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Không —</SelectItem>
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AdminUserStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="inactive">Ngưng</SelectItem>
                  <SelectItem value="locked">Khóa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tempPassword} onOpenChange={() => { setTempPassword(null); setCreatedSignPin(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thông tin tài khoản mới</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Sao chép thông tin bên dưới — email thiết lập mật khẩu cũng đã được gửi tới user (link dẫn về trang đặt mật khẩu lần đầu).
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Mật khẩu đăng nhập (12 ký tự)</p>
              <code className="block rounded-lg bg-muted p-3 text-sm font-mono break-all">{tempPassword}</code>
            </div>
            {createdSignPin && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Mã PIN ký duyệt (6 số — bác sĩ)</p>
                <code className="block rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm font-mono tracking-widest">{createdSignPin}</code>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Bác sĩ xem lại PIN tại Provider Portal → Hồ sơ bác sĩ.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => {
              const text = createdSignPin
                ? `Mật khẩu: ${tempPassword}\nPIN ký duyệt: ${createdSignPin}`
                : (tempPassword ?? '');
              void navigator.clipboard.writeText(text);
              toast.success('Đã copy');
            }}>
              Copy tất cả
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa người dùng?</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa vĩnh viễn {deleteTarget?.email}. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersContent;
