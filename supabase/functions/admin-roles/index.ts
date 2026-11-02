import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  clientIp,
  clientUserAgent,
  writeAuditLog,
} from "../_shared/audit.ts";
import { PERMISSIONS, getPermissionsForUser, isAuthContext, requirePermission } from "../_shared/rbac.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

const SYSTEM_ROLE_SLUGS = new Set(["patient", "doctor", "admin"]);

type ListBody = { action: "list" };
type PermissionsBody = { action: "permissions" };
type GetBody = { action: "get"; roleId: string };
type CreateBody = {
  action: "create";
  name: string;
  slug: string;
  description?: string;
  permissionIds: string[];
};
type UpdateBody = {
  action: "update";
  roleId: string;
  name?: string;
  description?: string;
  permissionIds?: string[];
};
type DeleteBody = { action: "delete"; roleId: string };
type MyPermissionsBody = { action: "my_permissions" };

type RequestBody =
  | ListBody
  | PermissionsBody
  | GetBody
  | CreateBody
  | UpdateBody
  | DeleteBody
  | MyPermissionsBody;

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  const ip = clientIp(req);
  const ua = clientUserAgent(req);

  if (body.action === "my_permissions") {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Thiếu access token" }, 401);
    }

    const admin = getAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user?.id) {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Token không hợp lệ" }, 401);
    }

    const userId = userData.user.id;
    const permissions = await getPermissionsForUser(admin, userId);
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.status === "locked" || profile?.status === "inactive") {
      return jsonResponse({ error: "FORBIDDEN", message: "Tài khoản bị khóa" }, 403);
    }

    return jsonResponse({
      permissions: [...permissions],
      portalRole: profile?.role ?? null,
    });
  }

  if (body.action === "permissions") {
    const auth = await requirePermission(req, PERMISSIONS.ROLES_READ);
    if (!isAuthContext(auth)) return auth;

    const { data, error } = await auth.admin
      .from("permissions")
      .select("id, slug, name, category")
      .order("category")
      .order("slug");

    if (error) return jsonResponse({ error: "DB_ERROR", message: error.message }, 500);
    return jsonResponse({ permissions: data ?? [] });
  }

  if (body.action === "list") {
    const auth = await requirePermission(req, PERMISSIONS.ROLES_READ);
    if (!isAuthContext(auth)) return auth;

    const { data: roles, error } = await auth.admin
      .from("roles")
      .select("id, slug, name, description, is_system, portal_role, created_at, updated_at")
      .order("is_system", { ascending: false })
      .order("name");

    if (error) return jsonResponse({ error: "DB_ERROR", message: error.message }, 500);

    const roleIds = (roles ?? []).map((r) => r.id);
    const { data: rpRows } = await auth.admin
      .from("role_permissions")
      .select("role_id, permission_id, permissions(id, slug, name, category)")
      .in("role_id", roleIds.length ? roleIds : ["00000000-0000-0000-0000-000000000000"]);

    const { data: userCounts } = await auth.admin
      .from("user_profiles")
      .select("role_id");

    const countByRole = new Map<string, number>();
    for (const row of userCounts ?? []) {
      if (row.role_id) {
        countByRole.set(row.role_id, (countByRole.get(row.role_id) ?? 0) + 1);
      }
    }

    const permsByRole = new Map<string, unknown[]>();
    for (const row of rpRows ?? []) {
      const list = permsByRole.get(row.role_id) ?? [];
      list.push(row.permissions);
      permsByRole.set(row.role_id, list);
    }

    const enriched = (roles ?? []).map((r) => ({
      ...r,
      userCount: countByRole.get(r.id) ?? 0,
      permissions: permsByRole.get(r.id) ?? [],
    }));

    return jsonResponse({ roles: enriched });
  }

  if (body.action === "get") {
    const auth = await requirePermission(req, PERMISSIONS.ROLES_READ);
    if (!isAuthContext(auth)) return auth;

    const { data: role, error } = await auth.admin
      .from("roles")
      .select("id, slug, name, description, is_system, portal_role")
      .eq("id", body.roleId)
      .maybeSingle();

    if (error) return jsonResponse({ error: "DB_ERROR", message: error.message }, 500);
    if (!role) return jsonResponse({ error: "NOT_FOUND" }, 404);

    const { data: perms } = await auth.admin
      .from("role_permissions")
      .select("permission_id, permissions(id, slug, name, category)")
      .eq("role_id", body.roleId);

    return jsonResponse({ role, permissions: (perms ?? []).map((p) => p.permissions) });
  }

  if (body.action === "create") {
    const auth = await requirePermission(req, PERMISSIONS.ROLES_CREATE);
    if (!isAuthContext(auth)) return auth;

    const slug = normalizeSlug(body.slug);
    if (!body.name?.trim() || !slug) {
      return jsonResponse({ error: "VALIDATION", message: "Thiếu tên hoặc slug role" }, 400);
    }
    if (SYSTEM_ROLE_SLUGS.has(slug)) {
      return jsonResponse({ error: "RESERVED_SLUG", message: "Slug trùng system role" }, 400);
    }

    const { data: role, error } = await auth.admin
      .from("roles")
      .insert({
        slug,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        is_system: false,
        portal_role: "customer",
      })
      .select("id, slug, name")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonResponse({ error: "SLUG_EXISTS", message: "Slug đã tồn tại" }, 409);
      }
      return jsonResponse({ error: "DB_ERROR", message: error.message }, 500);
    }

    if (body.permissionIds?.length) {
      const rows = body.permissionIds.map((pid) => ({
        role_id: role.id,
        permission_id: pid,
      }));
      const { error: rpError } = await auth.admin.from("role_permissions").insert(rows);
      if (rpError) {
        return jsonResponse({ error: "DB_ERROR", message: rpError.message }, 500);
      }
    }

    await writeAuditLog(auth.admin, {
      eventType: "ROLE_CREATED",
      userId: auth.userId,
      email: auth.email,
      ipAddress: ip,
      userAgent: ua,
      metadata: { roleId: role.id, slug, permissionIds: body.permissionIds ?? [] },
    });

    return jsonResponse({ message: "Tạo Role thành công", role });
  }

  if (body.action === "update") {
    const auth = await requirePermission(req, PERMISSIONS.ROLES_UPDATE);
    if (!isAuthContext(auth)) return auth;

    const { data: existing } = await auth.admin
      .from("roles")
      .select("id, is_system, slug")
      .eq("id", body.roleId)
      .maybeSingle();

    if (!existing) return jsonResponse({ error: "NOT_FOUND" }, 404);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;

    if (Object.keys(updates).length > 1) {
      const { error } = await auth.admin.from("roles").update(updates).eq("id", body.roleId);
      if (error) return jsonResponse({ error: "DB_ERROR", message: error.message }, 500);
    }

    if (body.permissionIds !== undefined) {
      if (existing.is_system) {
        return jsonResponse(
          { error: "SYSTEM_ROLE", message: "Không sửa permissions của system role qua API này" },
          403,
        );
      }
      await auth.admin.from("role_permissions").delete().eq("role_id", body.roleId);
      if (body.permissionIds.length) {
        const rows = body.permissionIds.map((pid) => ({
          role_id: body.roleId,
          permission_id: pid,
        }));
        const { error: rpError } = await auth.admin.from("role_permissions").insert(rows);
        if (rpError) return jsonResponse({ error: "DB_ERROR", message: rpError.message }, 500);
      }
    }

    await writeAuditLog(auth.admin, {
      eventType: "ROLE_UPDATED",
      userId: auth.userId,
      email: auth.email,
      ipAddress: ip,
      userAgent: ua,
      metadata: { roleId: body.roleId, updates: body },
    });

    return jsonResponse({ message: "Đã cập nhật role" });
  }

  if (body.action === "delete") {
    const auth = await requirePermission(req, PERMISSIONS.ROLES_DELETE);
    if (!isAuthContext(auth)) return auth;

    const { data: role } = await auth.admin
      .from("roles")
      .select("id, slug, is_system, name")
      .eq("id", body.roleId)
      .maybeSingle();

    if (!role) return jsonResponse({ error: "NOT_FOUND" }, 404);

    if (role.is_system || SYSTEM_ROLE_SLUGS.has(role.slug)) {
      return jsonResponse(
        { error: "SYSTEM_ROLE", message: "Không thể xóa Role mặc định của hệ thống" },
        403,
      );
    }

    const { count } = await auth.admin
      .from("user_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("role_id", body.roleId);

    if ((count ?? 0) > 0) {
      return jsonResponse(
        {
          error: "ROLE_IN_USE",
          message: `Role đang được ${count} user sử dụng. Vui lòng chuyển role trước khi xóa.`,
          userCount: count,
        },
        409,
      );
    }

    await auth.admin.from("role_permissions").delete().eq("role_id", body.roleId);
    const { error } = await auth.admin.from("roles").delete().eq("id", body.roleId);
    if (error) return jsonResponse({ error: "DB_ERROR", message: error.message }, 500);

    await writeAuditLog(auth.admin, {
      eventType: "ROLE_DELETED",
      userId: auth.userId,
      email: auth.email,
      ipAddress: ip,
      userAgent: ua,
      metadata: { roleId: body.roleId, slug: role.slug },
    });

    return jsonResponse({ message: "Đã xóa role" });
  }

  return jsonResponse({ error: "UNKNOWN_ACTION" }, 400);
});
