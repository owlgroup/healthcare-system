import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }),
    storage: { from: () => ({ upload: vi.fn() }) },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import AdminCreateProfileDialog from "@/components/admin/appointments/AdminCreateProfileDialog";

const CCCD_IDS = ["idNumber", "expirationDate", "residentialAddress", "issuedDate", "issuer"] as const;

describe("AdminCreateProfileDialog CCCD required fields", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
  });

  it("should show a red asterisk on the five CCCD identity labels", () => {
    render(
      <AdminCreateProfileDialog
        open
        onClose={() => undefined}
        onSuccess={() => undefined}
        profileId="profile-1"
        patientUserId="user-1"
      />,
    );

    expect(document.querySelector('label[for="idNumber"]')?.textContent).toMatch(/Số CCCD\s*\*/);
    expect(document.querySelector('label[for="expirationDate"]')?.textContent).toMatch(/Ngày hết hạn\s*\*/);
    expect(document.querySelector('label[for="residentialAddress"]')?.textContent).toMatch(/Địa chỉ thường trú\s*\*/);
    expect(document.querySelector('label[for="issuedDate"]')?.textContent).toMatch(/Ngày cấp\s*\*/);
    expect(document.querySelector('label[for="issuer"]')?.textContent).toMatch(/Nơi cấp\s*\*/);
  });

  it("should show Vui lòng nhập under empty CCCD fields and not save", () => {
    render(
      <AdminCreateProfileDialog
        open
        onClose={() => undefined}
        onSuccess={() => undefined}
        profileId="profile-1"
        patientUserId="user-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));

    for (const id of CCCD_IDS) {
      expect(document.getElementById(id)?.parentElement, id).toHaveTextContent("Vui lòng nhập");
    }
    expect(upsert).not.toHaveBeenCalled();
  });
});
