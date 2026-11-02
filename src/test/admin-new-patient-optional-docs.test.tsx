import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const upsert = vi.fn();
const createAdminUser = vi.fn();
const listAdminRoles = vi.fn();
const adminInsertPatientProfile = vi.fn();
const checkPatientDuplicate = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }),
    storage: { from: () => ({ upload: (...args: unknown[]) => upload(...args) }) },
  },
}));

vi.mock("@/lib/admin-api", () => ({
  createAdminUser: (...args: unknown[]) => createAdminUser(...args),
  listAdminRoles: (...args: unknown[]) => listAdminRoles(...args),
}));

vi.mock("@/lib/admin-appointment-api", () => ({
  adminInsertPatientProfile: (...args: unknown[]) => adminInsertPatientProfile(...args),
  staffCreatePatientProfile: vi.fn(),
}));

vi.mock("@/lib/duplicate-check", () => ({
  checkPatientDuplicate: (...args: unknown[]) => checkPatientDuplicate(...args),
  logDedupAudit: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import AdminNewPatientDialog from "@/components/admin/patients/AdminNewPatientDialog";

function fillRequiredTextFields() {
  fireEvent.change(document.getElementById("legalLastName")!, { target: { value: "Nguyễn" } });
  fireEvent.change(document.getElementById("legalFirstName")!, { target: { value: "An" } });
  fireEvent.change(document.getElementById("dateOfBirth")!, { target: { value: "1990-01-15" } });
  fireEvent.change(document.getElementById("phoneNumber")!, { target: { value: "0912345678" } });
  fireEvent.change(document.getElementById("idNumber")!, { target: { value: "012345678901" } });
  fireEvent.change(document.getElementById("expirationDate")!, { target: { value: "2030-01-01" } });
  fireEvent.change(document.getElementById("residentialAddress")!, { target: { value: "Hà Nội" } });
  fireEvent.change(document.getElementById("issuedDate")!, { target: { value: "2020-01-01" } });
  fireEvent.change(document.getElementById("issuer")!, { target: { value: "Cục cảnh sát QLHC về TTXH" } });
}

describe("AdminNewPatientDialog optional document uploads", () => {
  beforeEach(() => {
    upload.mockReset();
    upsert.mockReset();
    createAdminUser.mockReset();
    listAdminRoles.mockReset();
    adminInsertPatientProfile.mockReset();
    checkPatientDuplicate.mockReset();

    upsert.mockResolvedValue({ error: null });
    createAdminUser.mockResolvedValue({ userId: "user-1" });
    listAdminRoles.mockResolvedValue({ roles: [{ id: "role-patient", slug: "patient" }] });
    adminInsertPatientProfile.mockResolvedValue("profile-1");
    checkPatientDuplicate.mockResolvedValue({
      cccdMatchId: null,
      phoneMatchId: null,
      nameDobMatchId: null,
    });
  });

  it("labels CCCD front, CCCD back, and BHYT uploads as optional", () => {
    render(<AdminNewPatientDialog open onClose={() => undefined} onSuccess={() => undefined} />);

    expect(screen.getByText(/CCCD — mặt trước \(tùy chọn\)/)).toBeInTheDocument();
    expect(screen.getByText(/CCCD — mặt sau \(tùy chọn\)/)).toBeInTheDocument();
    expect(screen.getByText(/Thẻ BHYT \(tùy chọn\)/)).toBeInTheDocument();
  });

  it("should show Vui lòng nhập under empty required fields including CCCD text fields", () => {
    render(<AdminNewPatientDialog open onClose={() => undefined} onSuccess={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Tạo hồ sơ" }));

    expect(screen.getAllByText("Vui lòng nhập").length).toBeGreaterThanOrEqual(9);
    expect(screen.queryByText("Bắt buộc")).not.toBeInTheDocument();
    expect(document.querySelector('label[for="idNumber"]')?.textContent).toMatch(/Số CCCD\s*\*/);
    expect(document.querySelector('label[for="expirationDate"]')?.textContent).toMatch(/Ngày hết hạn\s*\*/);
    expect(document.querySelector('label[for="residentialAddress"]')?.textContent).toMatch(/Địa chỉ thường trú\s*\*/);
    expect(document.querySelector('label[for="issuedDate"]')?.textContent).toMatch(/Ngày cấp\s*\*/);
    expect(document.querySelector('label[for="issuer"]')?.textContent).toMatch(/Nơi cấp\s*\*/);
    expect(document.querySelector('label[for="legalLastName"]')?.textContent).toMatch(/Họ\s*\*/);

    for (const id of ["idNumber", "expirationDate", "residentialAddress", "issuedDate", "issuer"]) {
      expect(document.getElementById(id)?.parentElement, id).toHaveTextContent("Vui lòng nhập");
    }
  });

  it("should create a patient record when no CCCD or BHYT images are uploaded", async () => {
    const onSuccess = vi.fn();
    render(<AdminNewPatientDialog open onClose={() => undefined} onSuccess={onSuccess} />);

    fillRequiredTextFields();
    fireEvent.click(screen.getByRole("button", { name: "Tạo hồ sơ" }));

    await waitFor(() => expect(createAdminUser).toHaveBeenCalled());
    expect(adminInsertPatientProfile).toHaveBeenCalledWith(
      "user-1",
      "An",
      "Nguyễn",
      "0912345678",
      "1990-01-15",
      "012345678901",
    );
    expect(upsert).toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByText(/Vui lòng tải ảnh/)).not.toBeInTheDocument();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("should offer only Nam and Nữ gender options without Anh/Chị or Khác", async () => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;

    render(<AdminNewPatientDialog open onClose={() => undefined} onSuccess={() => undefined} />);

    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBeGreaterThanOrEqual(2);

    triggers[0].focus();
    fireEvent.keyDown(triggers[0], { key: "ArrowDown" });

    const options = await screen.findAllByRole("option", { hidden: true });
    const labels = options.map((option) => option.textContent?.trim());
    expect(labels).toEqual(["Nam", "Nữ"]);
    expect(labels).not.toContain("Khác");
    expect(labels.some((label) => label?.includes("Anh") || label?.includes("Chị"))).toBe(false);
  });

  it("should preview an uploaded document without closing the create dialog", () => {
    const onClose = vi.fn();
    render(<AdminNewPatientDialog open onClose={onClose} onSuccess={() => undefined} />);

    const input = document.getElementById("new-id-front") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["img"], "front.jpg", { type: "image/jpeg" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh CCCD — mặt trước (tùy chọn)" }));
    expect(screen.getByRole("dialog", { name: "Xem ảnh CCCD — mặt trước (tùy chọn)" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Xem ảnh CCCD — mặt trước (tùy chọn)" })).toHaveClass("pointer-events-auto");

    fireEvent.click(screen.getByRole("button", { name: "Đóng xem ảnh" }));

    expect(screen.queryByRole("dialog", { name: "Xem ảnh CCCD — mặt trước (tùy chọn)" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Tạo hồ sơ bệnh nhân mới/ })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
