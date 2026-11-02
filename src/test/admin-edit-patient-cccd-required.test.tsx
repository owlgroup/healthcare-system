import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatientPortalDetail } from "@/types/patient-portal";

const getPatientRecordById = vi.fn();
const createSignedUrl = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/patient-records", () => ({
  getPatientRecordById: (...args: unknown[]) => getPatientRecordById(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => createSignedUrl(...args),
      }),
    },
    from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import AdminEditPatientDialog from "@/components/admin/patients/AdminEditPatientDialog";

const record: PatientPortalDetail = {
  id: "profile-1",
  user_id: "user-1",
  legal_first_name: "Phạm",
  legal_last_name: "Phạm",
  full_name: "Phạm Phạm",
  date_of_birth: "1999-11-23",
  preferred_pronouns: "Nam",
  email_address: null,
  phone_number: "0912345678",
  id_number: "012345678901",
  residential_address: null,
  id_expiration_date: null,
  id_issued_date: null,
  id_issuer: null,
  insurance_provider: null,
  member_id: null,
  group_number: null,
  bhyt_name: null,
  bhyt_dob: null,
  bhyt_gender: null,
  bhyt_address: null,
  bhyt_kcb: null,
  bhyt_kcb_code: null,
  bhyt_valid_from: null,
  bhyt_five_year: null,
  id_document_storage_path: "user-1/front.jpg",
  id_document_back_storage_path: "user-1/back.jpg",
  card_front_storage_path: "user-1/bhyt.jpg",
  avatar_storage_path: null,
  submitted_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  consent_accepted: true,
  status: "ACTIVE",
};

const CCCD_IDS = ["idNumber", "expirationDate", "residentialAddress", "issuedDate", "issuer"] as const;

describe("AdminEditPatientDialog CCCD required fields", () => {
  beforeEach(() => {
    getPatientRecordById.mockReset();
    createSignedUrl.mockReset();
    upsert.mockReset();
    getPatientRecordById.mockResolvedValue({ record, error: null });
    createSignedUrl.mockImplementation((path: string) =>
      Promise.resolve({ data: { signedUrl: `https://cdn.example/${path}` }, error: null }),
    );
    upsert.mockResolvedValue({ error: null });
  });

  it("should show a red asterisk on the five CCCD identity labels", async () => {
    render(
      <AdminEditPatientDialog
        profileId="profile-1"
        open
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    await screen.findByRole("heading", { name: /Chỉnh sửa hồ sơ bệnh nhân/ });
    await waitFor(() => expect(document.getElementById("idNumber")).toBeTruthy());

    expect(document.querySelector('label[for="idNumber"]')?.textContent).toMatch(/Số CCCD\s*\*/);
    expect(document.querySelector('label[for="expirationDate"]')?.textContent).toMatch(/Ngày hết hạn\s*\*/);
    expect(document.querySelector('label[for="residentialAddress"]')?.textContent).toMatch(/Địa chỉ thường trú\s*\*/);
    expect(document.querySelector('label[for="issuedDate"]')?.textContent).toMatch(/Ngày cấp\s*\*/);
    expect(document.querySelector('label[for="issuer"]')?.textContent).toMatch(/Nơi cấp\s*\*/);
  });

  it("should show Vui lòng nhập under empty CCCD fields and not save", async () => {
    render(
      <AdminEditPatientDialog
        profileId="profile-1"
        open
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => {
      for (const id of CCCD_IDS) {
        if (id === "idNumber") continue;
        expect(document.getElementById(id)?.parentElement, id).toHaveTextContent("Vui lòng nhập");
      }
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
