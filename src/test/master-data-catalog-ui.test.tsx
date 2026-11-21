import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MasterDataContent from "@/components/admin/MasterDataContent";

vi.mock("@/lib/master-data-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/master-data-api")>();
  const empty = async () => ({ rows: [], total: 0 });
  const specialty = {
    id: "spec-1",
    name: "Cơ xương khớp",
    description: "Khám và điều trị bệnh xương khớp",
    icon: null,
    is_active: true,
    created_at: "2026-01-01",
  };
  return {
    ...actual,
    listSpecialtiesAdmin: vi.fn(async (params?: { status?: string }) => {
      if (params?.status === "inactive") return { rows: [], total: 1 };
      if (params?.status === "active") return { rows: [specialty], total: 11 };
      return { rows: [specialty], total: 12 };
    }),
    listServicesAdmin: empty,
    listFacilitiesAdmin: empty,
    listRoomsAdmin: empty,
    listDoctorSchedulesAdmin: empty,
    listQuestionCategoriesAdmin: empty,
  };
});

describe("MasterDataContent catalog design", () => {
  it("renders the warm catalog shell, specialty row, and active badge", async () => {
    render(<MasterDataContent />);

    expect(screen.getByRole("heading", { name: "Danh mục hệ thống" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).textContent).toContain("Quản trị");
    expect(screen.getByRole("button", { name: /Thêm Chuyên khoa/ })).toHaveClass("bg-[#C41740]");
    expect(screen.getByRole("tab", { name: /Chuyên khoa/ })).toHaveAttribute("data-state", "active");

    expect(await screen.findByText("Cơ xương khớp")).toBeInTheDocument();
    expect(screen.getByText("Hoạt động")).toHaveClass("bg-[#E9F7EE]", "text-[#157F3D]");
    expect(screen.getByRole("button", { name: "Vô hiệu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });
});
