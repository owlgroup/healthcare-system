import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminUsersContent from "@/components/admin/AdminUsersContent";
import type { AdminRoleRow, AdminUserRow } from "@/lib/admin-api";

const doctor: AdminUserRow = {
  user_id: "u-doc",
  email: "lethi@gmail.com",
  full_name: "Lê Thị Hồng Xoan",
  phone: null,
  role: "doctor",
  status: "active",
  specialty: "Da liễu",
  facility_id: "f1",
  role_id: "r-doc",
  updated_at: "2026-10-01",
  facilities: { name: "Rcare Plus Main Clinic" },
  roles: { id: "r-doc", name: "Bác sĩ", slug: "doctor", portal_role: "doctor" },
};

const inactive: AdminUserRow = {
  ...doctor,
  user_id: "u-off",
  email: "off@gmail.com",
  full_name: "Trần Văn Hải",
  role: "patient",
  status: "inactive",
  specialty: null,
  facility_id: null,
  role_id: "r-pat",
  facilities: null,
  roles: { id: "r-pat", name: "Bệnh nhân", slug: "patient", portal_role: "patient" },
};

const roles: AdminRoleRow[] = [
  {
    id: "r-doc",
    slug: "doctor",
    name: "Bác sĩ",
    description: null,
    is_system: true,
    portal_role: "doctor",
    userCount: 1,
    permissions: [],
  },
];

vi.mock("@/lib/admin-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-api")>();
  return {
    ...actual,
    listAdminUsers: vi.fn(async () => ({ users: [doctor, inactive], total: 2, page: 1, limit: 20 })),
    listAdminRoles: vi.fn(async () => ({ roles })),
    listFacilities: vi.fn(async () => ({ facilities: [{ id: "f1", name: "Rcare Plus Main Clinic", code: null }] })),
  };
});

vi.mock("@/lib/appointment-api", () => ({
  fetchSpecialties: vi.fn(async () => [{ id: "s1", name: "Da liễu" }]),
}));

describe("AdminUsersContent design", () => {
  it("renders the warm users shell, role badge, and inactive status", async () => {
    render(<AdminUsersContent />);

    expect(screen.getByRole("heading", { name: "Quản lý người dùng" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).textContent).toContain("Người dùng");
    expect(screen.getByRole("button", { name: /Thêm người dùng/ })).toHaveClass("bg-[#C41740]");
    expect(screen.getByRole("button", { name: "Tất cả" })).toHaveClass("bg-[#FCEBEF]", "text-[#C41740]");

    expect(await screen.findByText("Lê Thị Hồng Xoan")).toBeInTheDocument();
    const roleBadge = screen.getAllByText("Bác sĩ").find((el) => el.tagName === "SPAN");
    expect(roleBadge).toHaveClass("bg-[#EAF0FF]", "text-[#1D4FD8]");
    expect(screen.getByText("Chuyên khoa: Da liễu")).toHaveClass("text-[#C41740]");
    expect(screen.getByText("Vô hiệu")).toHaveClass("bg-[#F0EEEC]", "text-[#7A726D]");
    expect(screen.getAllByRole("button", { name: "Sửa" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Xóa" })[0]).toHaveClass("text-[#C41740]");
  });
});
