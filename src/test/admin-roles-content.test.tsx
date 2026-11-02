import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const listAdminRoles = vi.fn();
const listPermissions = vi.fn();
const createAdminRole = vi.fn();
const updateAdminRole = vi.fn();
const deleteAdminRole = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/admin-api", () => ({
  listAdminRoles: (...args: unknown[]) => listAdminRoles(...args),
  listPermissions: (...args: unknown[]) => listPermissions(...args),
  createAdminRole: (...args: unknown[]) => createAdminRole(...args),
  updateAdminRole: (...args: unknown[]) => updateAdminRole(...args),
  deleteAdminRole: (...args: unknown[]) => deleteAdminRole(...args),
}));

import AdminRolesContent from "@/components/admin/AdminRolesContent";

const permissions = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `p-a-${i}`,
    slug: `admin.perm_${i}`,
    name: `Admin permission ${i}`,
    category: "admin",
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `p-c-${i}`,
    slug: `clinical.perm_${i}`,
    name: `Clinical permission ${i}`,
    category: "clinical",
  })),
];

const systemRole = {
  id: "role-admin",
  name: "Quản trị",
  slug: "admin",
  description: "Cổng quản trị",
  is_system: true,
  userCount: 2,
  permissions: permissions.slice(0, 2),
};

const customRole = {
  id: "role-custom",
  name: "Lễ tân",
  slug: "le-tan",
  description: "Tiếp đón",
  is_system: false,
  userCount: 0,
  permissions: permissions.slice(0, 11),
};

function renderPage() {
  return render(
    <TooltipProvider>
      <AdminRolesContent />
    </TooltipProvider>,
  );
}

describe("Admin role management", () => {
  beforeEach(() => {
    listAdminRoles.mockReset();
    listPermissions.mockReset();
    createAdminRole.mockReset();
    updateAdminRole.mockReset();
    deleteAdminRole.mockReset();
    listPermissions.mockResolvedValue({ permissions });
    listAdminRoles.mockResolvedValue({ roles: [systemRole, customRole] });
    createAdminRole.mockResolvedValue(undefined);
    updateAdminRole.mockResolvedValue(undefined);
  });

  it("shows the portal heading and hides system-role actions", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Quản lý vai trò" })).toBeInTheDocument();
    expect(screen.getByText("Phân quyền động")).toBeInTheDocument();
    expect(screen.getByText("Hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Vai trò tùy chỉnh")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Sửa vai trò" })).toHaveLength(1);
    expect(screen.queryAllByRole("button", { name: "Xóa vai trò" })).toHaveLength(1);
  });

  it("collapses permission groups when a role has more than ten permissions", async () => {
    renderPage();
    expect(await screen.findByText(/11 quyền · 2 nhóm/)).toBeInTheDocument();
    expect(screen.getByText("Xem chi tiết")).toBeInTheDocument();
  });

  it("derives a slug from the role name until the code field is edited", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Vai trò mới/ }));
    const name = await screen.findByLabelText(/Tên vai trò/);
    fireEvent.change(name, { target: { value: "Lễ tân" } });
    expect(screen.getByLabelText("Mã định danh")).toHaveValue("le-tan");
    fireEvent.change(screen.getByLabelText("Mã định danh"), { target: { value: "custom-code" } });
    fireEvent.change(name, { target: { value: "Giám sát" } });
    expect(screen.getByLabelText("Mã định danh")).toHaveValue("custom-code");
  });

  it("hides the slug field when editing an existing role", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa vai trò" }));
    expect(await screen.findByRole("heading", { name: "Sửa vai trò" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Mã định danh")).not.toBeInTheDocument();
  });

  it("creates a role with the selected permissions", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Vai trò mới/ }));
    fireEvent.change(await screen.findByLabelText(/Tên vai trò/), { target: { value: "Lễ tân" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Chọn tất cả" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Lưu vai trò" }));
    await waitFor(() => expect(createAdminRole).toHaveBeenCalled());
    expect(createAdminRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lễ tân",
        slug: "le-tan",
        permissionIds: expect.arrayContaining(["p-a-0"]),
      }),
    );
  });
});
