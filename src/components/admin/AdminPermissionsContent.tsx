import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, Shield } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPermissionCategoryLabel,
  getPermissionDisplayName,
  getRoleSlugLabel,
  groupPermissionsByCategory,
} from "@/config/rbac-permissions";
import {
  AdminApiError,
  listAdminRoles,
  listPermissions,
  type AdminRoleRow,
  type PermissionRow,
} from "@/lib/admin-api";

const ROLE_CHIP_ORDER = ["admin", "doctor", "patient", "customer"];

const roleChipClass = (slug: string) => {
  switch (slug) {
    case "admin":
      return "bg-[#FCEBEF] text-[#C41740]";
    case "doctor":
      return "bg-[#EAF0FF] text-[#1D4FD8]";
    case "patient":
      return "bg-[#E9F7EE] text-[#157F3D]";
    default:
      return "bg-[#F1ECFD] text-[#6D3FC9]";
  }
};

const roleLabel = (role: AdminRoleRow) => {
  const name = role.name?.trim();
  if (name && name.toLowerCase() !== role.slug) return name;
  return getRoleSlugLabel(role.slug);
};

const compareRoles = (a: AdminRoleRow, b: AdminRoleRow) => {
  const ai = ROLE_CHIP_ORDER.indexOf(a.slug);
  const bi = ROLE_CHIP_ORDER.indexOf(b.slug);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  return roleLabel(a).localeCompare(roleLabel(b), "vi");
};

const AdminPermissionsContent = () => {
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [roles, setRoles] = useState<AdminRoleRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [permRes, roleRes] = await Promise.all([listPermissions(), listAdminRoles()]);
      setPermissions(permRes.permissions);
      setRoles(roleRes.roles);
    } catch (err) {
      toast.error(err instanceof AdminApiError ? err.message : "Không tải được danh sách quyền");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rolesByPermission = useMemo(() => {
    const map = new Map<string, AdminRoleRow[]>();
    for (const role of roles) {
      for (const perm of role.permissions ?? []) {
        for (const key of [perm.id, perm.slug]) {
          if (!key) continue;
          const list = map.get(key) ?? [];
          if (!list.some((item) => item.id === role.id)) list.push(role);
          map.set(key, list);
        }
      }
    }
    for (const list of map.values()) list.sort(compareRoles);
    return map;
  }, [roles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((perm) => {
      const name = getPermissionDisplayName(perm).toLowerCase();
      return name.includes(q) || perm.slug.toLowerCase().includes(q);
    });
  }, [permissions, query]);

  const byCategory = useMemo(() => groupPermissionsByCategory(filtered), [filtered]);
  const visibleCount = byCategory.reduce((sum, [, items]) => sum + items.length, 0);

  const rolesFor = (perm: PermissionRow) => rolesByPermission.get(perm.id) ?? rolesByPermission.get(perm.slug) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bảo mật › <span className="text-primary">Danh sách quyền</span>
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Danh sách quyền hệ thống</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Chỉ xem. Quyền hệ thống không thể chỉnh sửa tại đây; gán quyền cho người dùng qua Quản lý vai trò.
          </p>
        </div>
        <Button variant="outline" className="h-9 shrink-0 cursor-pointer" asChild>
          <Link to="/admin/roles">Đến Quản lý vai trò →</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm quyền…"
                className="h-9 bg-muted/40 pl-9"
                aria-label="Tìm quyền"
              />
            </label>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {visibleCount} quyền · {byCategory.length} nhóm
            </span>
          </div>

          {byCategory.length === 0 ? (
            <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              Không có quyền phù hợp.
            </div>
          ) : (
            byCategory.map(([category, items]) => (
              <div key={category} className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                    {getPermissionCategoryLabel(category)}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{items.length} quyền</span>
                </div>
                {items.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0"
                  >
                    <span className="grid text-primary">
                      <Shield className="h-[15px] w-[15px]" />
                    </span>
                    <div className="flex min-w-[220px] flex-1 flex-col">
                      <span className="text-sm font-medium text-foreground">{getPermissionDisplayName(perm)}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{perm.slug}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rolesFor(perm).map((role) => (
                        <span
                          key={role.id}
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleChipClass(role.slug)}`}
                        >
                          {roleLabel(role)}
                        </span>
                      ))}
                    </div>
                    <Badge variant="secondary" className="whitespace-nowrap text-[11px] font-semibold">
                      Không chỉnh sửa
                    </Badge>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPermissionsContent;
