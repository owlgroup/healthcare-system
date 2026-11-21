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
import { decryptRows, encrypt } from "@/lib/crypto";
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
const statusLabel: Record<AdminUserStatus, string> = {
  active: "Hoạt động",
  inactive: "Vô hiệu",
  locked: "Khóa",
};

const statusStyle: Record<AdminUserStatus, string> = {
  active: "bg-[#E9F7EE] text-[#157F3D]",
  inactive: "bg-[#F0EEEC] text-[#7A726D]",
  locked: "bg-[#FFF4DD] text-[#A65F00]",
};

/** Màu badge vai trò / avatar theo portal (vai trò tùy chỉnh dùng tím design). */
const roleTone = (user: AdminUserRow) => {
  const portal = user.roles?.portal_role ?? user.role;
  if (portal === "admin") return "bg-[#FCEBEF] text-[#C41740]";
  if (portal === "doctor") return "bg-[#EAF0FF] text-[#1D4FD8]";
  if (portal === "patient") return "bg-[#E9F7EE] text-[#157F3D]";
  return "bg-[#F1ECFD] text-[#6D3FC9]";
};

const chipClass = (active: boolean) =>
  `h-[30px] cursor-pointer whitespace-nowrap rounded-full border px-3 text-[12.5px] transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] ${
    active
      ? "border-[#F3C9D3] bg-[#FCEBEF] font-semibold text-[#C41740]"
      : "border-[#E1DDDA] bg-white font-medium text-[#4A4440] hover:bg-[#FAF9F8]"
  }`;

const fieldClass =
  "h-[38px] w-full rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-sm text-[#1A1614] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#C41740]";

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
      setUsers(await decryptRows(usersRes.users, "user_profiles"));
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
      const phone = await encrypt(form.phone.trim());
      if (editing) {
        const res = await updateAdminUser({
          userId: editing.user_id,
          fullName: form.fullName,
          phone,
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
          phone,
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
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3.5 text-[#1A1614]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <nav aria-label="Breadcrumb" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A928D]">
            Tổ chức › <span className="text-[#C41740]">Người dùng</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1614]">Quản lý người dùng</h1>
          <p className="text-pretty text-[#7A726D]">Tài khoản truy cập hệ thống theo vai trò và cơ sở.</p>
        </div>
        <Button
          onClick={openCreate}
          className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-lg bg-[#C41740] px-3.5 font-semibold text-white hover:bg-[#A8123A] focus-visible:ring-[#C41740]"
        >
          <UserPlus className="h-4 w-4" />
          Thêm người dùng
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E8E5E2] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#EFECEA] px-4 py-3">
          <label className="flex h-9 min-w-0 w-full items-center gap-2 rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-[#7A726D] focus-within:ring-2 focus-within:ring-[#C41740]">
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên, email, SĐT…"
              aria-label="Tìm theo tên, email, SĐT"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#1A1614] outline-none placeholder:text-[#9A928D]"
            />
          </label>
          <div className="flex max-w-full flex-wrap gap-1.5" role="group" aria-label="Lọc theo vai trò">
            {roleChips.map((chip) => {
              const active = roleFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setRoleFilter(chip.id)}
                  aria-pressed={active}
                  className={chipClass(active)}
                >
                  {chip.name}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#7A726D]">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Đang tải...
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#7A726D]">
            <Users className="mb-2 h-10 w-10 opacity-40" aria-hidden="true" />
            <p>{users.length === 0 ? "Chưa có người dùng" : "Không tìm thấy người dùng."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-[#EFECEA] bg-[#FAF9F8]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#7A726D]">Người dùng</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#7A726D]">Vai trò</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#7A726D]">Cơ sở</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#7A726D]">Trạng thái</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#7A726D]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const tone = roleTone(user);
                  return (
                    <tr key={user.user_id} className="border-b border-[#F0EDEB] transition-colors duration-200 last:border-0 hover:bg-[#FCFBFA] motion-reduce:transition-none">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-xs font-bold ${tone}`}>
                            {initials(user.full_name, user.email)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#1A1614]">{user.full_name ?? "—"}</p>
                            <p className="truncate text-xs text-[#7A726D]">{user.email}</p>
                            {user.specialty && (
                              <p className="text-[11.5px] text-[#C41740]">Chuyên khoa: {user.specialty}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>
                          {user.roles?.name ?? user.role}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${user.facilities?.name ? "text-[#1A1614]" : "text-[#9A928D]"}`}>
                        {user.facilities?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${statusStyle[user.status]}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                          {statusLabel[user.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button type="button" className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] text-[#7A726D] transition-colors duration-200 hover:bg-[#F5F4F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] motion-reduce:transition-none" onClick={() => openEdit(user)} title="Sửa" aria-label="Sửa">
                            <Pencil className="h-[15px] w-[15px]" />
                          </button>
                          <button type="button" className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] text-[#7A726D] transition-colors duration-200 hover:bg-[#F5F4F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] motion-reduce:transition-none" onClick={() => handleResetPassword(user)} title="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu">
                            <RotateCcw className="h-[15px] w-[15px]" />
                          </button>
                          <button type="button" className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] text-[#C41740] transition-colors duration-200 hover:bg-[#FCEBEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] motion-reduce:transition-none" onClick={() => setDeleteTarget(user)} title="Xóa" aria-label="Xóa">
                            <Trash2 className="h-[15px] w-[15px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#EFECEA] bg-[#FAF9F8] px-4 py-3">
          <p className="text-sm text-[#7A726D]">
            Tổng <span className="font-semibold text-[#1A1614]">{total}</span> người dùng
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 cursor-pointer rounded-lg border-[#D9D5D1] bg-white font-semibold text-[#1A1614] hover:bg-[#F5F4F2]"
            >
              Trước
            </Button>
            <span className="text-sm text-[#4A4440]">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 cursor-pointer rounded-lg border-[#D9D5D1] bg-white font-semibold text-[#1A1614] hover:bg-[#F5F4F2]"
            >
              Sau
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          hideClose
          overlayClassName="bg-[rgba(26,22,20,0.4)]"
          className="max-w-[480px] gap-0 overflow-hidden rounded-[14px] border-0 bg-white p-0 text-[#1A1614] shadow-[0_24px_64px_rgba(26,22,20,0.3)]"
        >
          <DialogHeader className="flex-row items-start justify-between space-y-0 px-5 pb-3 pt-[18px] text-left">
            <DialogTitle className="text-[17px] font-bold text-[#1A1614]">
              {editing ? "Sửa người dùng" : "Thêm người dùng mới"}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg border border-[#E1DDDA] bg-white text-base text-[#4A4440] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
              aria-label="Đóng"
            >
              ×
            </button>
          </DialogHeader>
          <div className="grid gap-3.5 px-5 pb-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName" className="text-xs font-semibold text-[#4A4440]">Họ tên <span className="text-[#C41740]">*</span></Label>
              <Input id="fullName" value={form.fullName} placeholder="Nguyễn Văn A" onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={fieldClass} />
            </div>
            {!editing && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#4A4440]">Email <span className="text-[#C41740]">*</span></Label>
                <Input id="email" type="email" value={form.email} placeholder="ten@email.com" onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-[#4A4440]">Số điện thoại</Label>
              <Input id="phone" value={form.phone} placeholder="09xx xxx xxx" onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#4A4440]">Vai trò <span className="text-[#C41740]">*</span></span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Vai trò">
                {roles.map((r) => (
                  <button key={r.id} type="button" aria-pressed={form.roleId === r.id} className={chipClass(form.roleId === r.id)} onClick={() => setForm({ ...form, roleId: r.id })}>
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
            {isDoctor && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#4A4440]">Chuyên khoa</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chuyên khoa">
                  <button type="button" aria-pressed={!form.specialty} className={chipClass(!form.specialty)} onClick={() => setForm({ ...form, specialty: "" })}>Không</button>
                  {specialties.map((s) => (
                    <button key={s.id} type="button" aria-pressed={form.specialty === s.name} className={chipClass(form.specialty === s.name)} onClick={() => setForm({ ...form, specialty: s.name })}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#4A4440]">Cơ sở</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cơ sở">
                <button type="button" aria-pressed={!form.facilityId} className={chipClass(!form.facilityId)} onClick={() => setForm({ ...form, facilityId: "" })}>Không</button>
                {facilities.map((f) => (
                  <button key={f.id} type="button" aria-pressed={form.facilityId === f.id} className={chipClass(form.facilityId === f.id)} onClick={() => setForm({ ...form, facilityId: f.id })}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#4A4440]">Trạng thái</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Trạng thái">
                {(["active", "inactive", "locked"] as AdminUserStatus[]).map((status) => (
                  <button key={status} type="button" aria-pressed={form.status === status} className={chipClass(form.status === status)} onClick={() => setForm({ ...form, status })}>
                    {statusLabel[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-[#EFECEA] bg-[#FAF9F8] px-5 py-3 sm:space-x-0">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="h-9 cursor-pointer rounded-lg border-[#D9D5D1] bg-white font-semibold text-[#1A1614] hover:bg-[#F5F4F2]">Hủy</Button>
            <Button onClick={handleSave} disabled={saving} className="h-9 cursor-pointer rounded-lg bg-[#C41740] font-semibold text-white hover:bg-[#A8123A] focus-visible:ring-[#C41740]">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tempPassword} onOpenChange={() => { setTempPassword(null); setCreatedSignPin(null); }}>
        <DialogContent
          overlayClassName="bg-[rgba(26,22,20,0.4)]"
          className="rounded-[14px] border-[#E8E5E2] bg-white text-[#1A1614] shadow-[0_24px_64px_rgba(26,22,20,0.3)]"
        >
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold text-[#1A1614]">Thông tin tài khoản mới</DialogTitle>
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
            <Button
              className="h-9 cursor-pointer rounded-lg bg-[#C41740] font-semibold text-white hover:bg-[#A8123A] focus-visible:ring-[#C41740]"
              onClick={() => {
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
            <AlertDialogAction onClick={handleDelete} className="bg-[#C41740] text-white hover:bg-[#A8123A]">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersContent;
