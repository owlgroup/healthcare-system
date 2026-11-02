import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminApiError,
  createAdminRole,
  deleteAdminRole,
  listAdminRoles,
  listPermissions,
  updateAdminRole,
  type AdminRoleRow,
  type PermissionRow,
} from "@/lib/admin-api";
import {
  getPermissionCategoryLabel,
  getPermissionDisplayName,
  getRoleDescriptionLabel,
  groupPermissionsByCategory,
} from "@/config/rbac-permissions";
import RolePermissionsSummary from "@/components/admin/RolePermissionsSummary";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ROLE_TONES: Record<string, { bg: string; fg: string }> = {
  doctor: { bg: "#EAF0FF", fg: "#1D4FD8" },
  patient: { bg: "#E9F7EE", fg: "#157F3D" },
  admin: { bg: "#FCEBEF", fg: "#C41740" },
  customer: { bg: "#F1ECFD", fg: "#6D3FC9" },
};

function roleTone(slug: string) {
  return ROLE_TONES[slug] ?? { bg: "#F1ECFD", fg: "#6D3FC9" };
}

function slugifyRoleCode(value: string) {
  return value
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type RoleFormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  permissionIds: Set<string>;
  codeEdited: boolean;
};

const emptyForm = (): RoleFormState => ({
  id: null,
  name: "",
  slug: "",
  description: "",
  permissionIds: new Set(),
  codeEdited: false,
});

export default function AdminRolesContent() {
  const [roles, setRoles] = useState<AdminRoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRoleRow | null>(null);

  const groupedPermissions = useMemo(() => groupPermissionsByCategory(permissions), [permissions]);

  const load = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([listAdminRoles(), listPermissions()]);
      setRoles(rolesRes.roles ?? []);
      setPermissions(permsRes.permissions ?? []);
    } catch (error) {
      toast.error(error instanceof AdminApiError ? error.message : "Không tải được vai trò");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (role: AdminRoleRow) => {
    if (role.is_system) {
      toast.error("Vai trò hệ thống không thể sửa quyền hạn");
      return;
    }
    setForm({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description ?? "",
      permissionIds: new Set(role.permissions.map((item) => item.id)),
      codeEdited: true,
    });
    setDialogOpen(true);
  };

  const togglePermission = (permissionId: string) => {
    setForm((prev) => {
      const next = new Set(prev.permissionIds);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return { ...prev, permissionIds: next };
    });
  };

  const toggleCategory = (ids: string[]) => {
    setForm((prev) => {
      const allOn = ids.every((id) => prev.permissionIds.has(id));
      const next = new Set(prev.permissionIds);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return { ...prev, permissionIds: next };
    });
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.id || prev.codeEdited ? prev.slug : slugifyRoleCode(name),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nhập tên vai trò");
      return;
    }
    if (!form.id && !form.slug.trim()) {
      toast.error("Nhập mã định danh");
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await updateAdminRole({
          roleId: form.id,
          name: form.name.trim(),
          description: form.description.trim(),
          permissionIds: [...form.permissionIds],
        });
        toast.success("Đã cập nhật vai trò");
      } else {
        await createAdminRole({
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || undefined,
          permissionIds: [...form.permissionIds],
        });
        toast.success("Đã tạo vai trò");
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof AdminApiError ? error.message : "Không lưu được vai trò");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAdminRole(deleteTarget.id);
      toast.success("Đã xóa vai trò");
      setDeleteTarget(null);
      await load();
    } catch (error) {
      if (error instanceof AdminApiError && error.code === "ROLE_IN_USE") {
        toast.error("Không thể xóa vai trò đang được gán cho người dùng");
      } else {
        toast.error(error instanceof AdminApiError ? error.message : "Không xóa được vai trò");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Đang tải vai trò…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A928D]">
            Bảo mật › <span className="text-primary">Phân quyền động</span>
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Quản lý vai trò</h1>
          <p className="max-w-2xl text-pretty text-[13px] text-[#7A726D]">
            Tạo vai trò tùy chỉnh với quyền hạn tự chọn. Vai trò hệ thống (Bệnh nhân, Bác sĩ, Quản trị)
            không thể xóa.
          </p>
        </div>
        <Button
          type="button"
          className="h-9 cursor-pointer gap-1.5 rounded-lg px-3.5 font-semibold transition-colors duration-200"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Vai trò mới
        </Button>
      </div>

      <div className="flex flex-col gap-3.5">
        {roles.map((role) => {
          const tone = roleTone(role.slug);
          return (
            <div
              key={role.id}
              className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3.5 rounded-xl border border-[#E8E5E2] bg-white p-4 sm:px-[18px]"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-[10px]"
                style={{ background: tone.bg, color: tone.fg }}
              >
                <Shield className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-foreground">{role.name}</span>
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      role.is_system
                        ? "bg-[#F0EEEC] text-[#57524E]"
                        : "bg-[#F1ECFD] text-[#6D3FC9]",
                    )}
                  >
                    {role.is_system ? "Hệ thống" : "Vai trò tùy chỉnh"}
                  </span>
                  <span className="whitespace-nowrap rounded-full border border-[#E1DDDA] px-2 py-0.5 text-[11px] font-semibold text-[#57524E]">
                    {role.userCount} người dùng
                  </span>
                </div>
                <span className="text-xs text-[#7A726D]">
                  Mã vai trò:{" "}
                  <span className="font-mono text-foreground">{role.slug}</span>
                  {" · "}
                  {getRoleDescriptionLabel(role.slug, role.description)}
                </span>
                <RolePermissionsSummary permissions={role.permissions} />
              </div>
              {!role.is_system ? (
                <div className="flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-[30px] w-[30px] cursor-pointer rounded-[7px] text-[#7A726D] transition-colors duration-200 hover:bg-[#F5F4F2] hover:text-foreground"
                    onClick={() => openEdit(role)}
                    aria-label="Sửa vai trò"
                  >
                    <Pencil className="h-[15px] w-[15px]" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-[30px] w-[30px] cursor-pointer rounded-[7px] text-primary transition-colors duration-200 hover:bg-[#FCEBEF] hover:text-primary"
                    onClick={() => setDeleteTarget(role)}
                    disabled={role.userCount > 0}
                    aria-label="Xóa vai trò"
                  >
                    <Trash2 className="h-[15px] w-[15px]" />
                  </Button>
                </div>
              ) : (
                <div />
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-48px)] max-w-[560px] gap-0 overflow-hidden rounded-[14px] border-[#E8E5E2] p-0 shadow-[0_24px_64px_rgba(26,22,20,0.3)] sm:rounded-[14px]">
          <DialogHeader className="space-y-0 px-5 pb-3 pt-[18px] text-left">
            <DialogTitle className="text-[17px] font-bold">
              {form.id ? "Sửa vai trò" : "Vai trò tùy chỉnh mới"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Nhập tên, mã định danh và chọn quyền hạn cho vai trò.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[min(60vh,calc(100vh-180px))] gap-3.5 overflow-y-auto px-5 pb-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name" className="text-xs font-semibold text-[#4A4440]">
                Tên vai trò <span className="text-primary">*</span>
              </Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="VD: Lễ tân"
                className="h-[38px] rounded-lg border-[#E1DDDA] bg-[#FAF9F8]"
              />
            </div>
            {!form.id ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role-slug" className="text-xs font-semibold text-[#4A4440]">
                  Mã định danh
                </Label>
                <Input
                  id="role-slug"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      slug: slugifyRoleCode(event.target.value),
                      codeEdited: true,
                    }))
                  }
                  placeholder="le-tan"
                  className="h-[38px] rounded-lg border-[#E1DDDA] bg-[#FAF9F8] font-mono"
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-description" className="text-xs font-semibold text-[#4A4440]">
                Mô tả
              </Label>
              <Input
                id="role-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Mô tả phạm vi công việc"
                className="h-[38px] rounded-lg border-[#E1DDDA] bg-[#FAF9F8]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4A4440]">Quyền hạn</span>
              <span className="text-xs font-semibold text-primary">{form.permissionIds.size} đã chọn</span>
            </div>
            <div className="flex flex-col gap-2">
              {groupedPermissions.map(([category, items]) => {
                const ids = items.map((item) => item.id);
                const allOn = ids.length > 0 && ids.every((id) => form.permissionIds.has(id));
                return (
                  <div key={category} className="overflow-hidden rounded-[10px] border border-[#ECE8E5]">
                    <div className="flex items-center justify-between border-b border-[#EFECEA] bg-[#FAF9F8] px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#57524E]">
                        {getPermissionCategoryLabel(category)}
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-primary transition-colors duration-200 hover:underline"
                        onClick={() => toggleCategory(ids)}
                      >
                        {allOn ? "Bỏ chọn" : "Chọn tất cả"}
                      </button>
                    </div>
                    {items.map((permission) => {
                      const selected = form.permissionIds.has(permission.id);
                      return (
                        <label
                          key={permission.id}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2.5 border-b border-[#F5F2F0] px-3 py-2 text-left text-sm last:border-b-0",
                            selected ? "bg-[#FFF8F9]" : "bg-white",
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => togglePermission(permission.id)}
                            className="h-[18px] w-[18px] rounded-[5px]"
                          />
                          <span>{getPermissionDisplayName(permission)}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="border-t border-[#EFECEA] bg-[#FAF9F8] px-5 py-3 sm:justify-end sm:space-x-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 cursor-pointer rounded-lg border-[#D9D5D1] bg-white font-semibold"
              onClick={() => setDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              className="h-9 cursor-pointer rounded-lg font-semibold"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lưu vai trò
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[420px] gap-0 overflow-hidden rounded-[14px] border-[#E8E5E2] p-0 shadow-[0_24px_64px_rgba(26,22,20,0.3)]">
          <AlertDialogHeader className="space-y-0 px-5 pb-2 pt-[18px] text-left">
            <AlertDialogTitle className="text-[17px] font-bold">Xóa vai trò</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="px-5 pb-4 text-sm leading-relaxed text-[#57524E]">
            Vai trò &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Người dùng đang giữ vai trò này cần được
            gán lại.
          </AlertDialogDescription>
          <AlertDialogFooter className="border-t border-[#EFECEA] bg-[#FAF9F8] px-5 py-3 sm:justify-end sm:space-x-2">
            <AlertDialogCancel className="mt-0 h-9 cursor-pointer rounded-lg border-[#D9D5D1] bg-white font-semibold">
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 cursor-pointer rounded-lg bg-primary font-semibold hover:bg-primary/90"
              onClick={() => void handleDelete()}
              disabled={(deleteTarget?.userCount ?? 0) > 0}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
