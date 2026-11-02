import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatientPortalDetail } from "@/types/patient-portal";

const getPatientRecordById = vi.fn();
const createSignedUrl = vi.fn();

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
    from: () => ({ upsert: vi.fn() }),
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

describe("AdminEditPatientDialog document preview", () => {
  beforeEach(() => {
    getPatientRecordById.mockReset();
    createSignedUrl.mockReset();
    getPatientRecordById.mockResolvedValue({ record, error: null });
    createSignedUrl.mockImplementation((path: string) =>
      Promise.resolve({ data: { signedUrl: `https://cdn.example/${path}` }, error: null }),
    );
  });

  it("should show an eye icon to preview each document photo", async () => {
    render(
      <AdminEditPatientDialog
        profileId="profile-1"
        open
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    expect(await screen.findByRole("button", { name: "Xem ảnh CCCD mặt trước" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem ảnh CCCD mặt sau" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem ảnh Thẻ BHYT" })).toBeInTheDocument();
  });

  it("should open a full-size preview when the eye icon is clicked", async () => {
    render(
      <AdminEditPatientDialog
        profileId="profile-1"
        open
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Xem ảnh CCCD mặt trước" }));

    const lightbox = await screen.findByRole("dialog", { name: "Xem ảnh CCCD mặt trước" });
    expect(lightbox).toBeInTheDocument();
    expect(lightbox).toHaveClass("pointer-events-auto");
    expect(screen.getByRole("img", { name: "Xem trước CCCD mặt trước" })).toHaveAttribute(
      "src",
      "https://cdn.example/user-1/front.jpg",
    );
  });

  it("should close only the preview when the preview close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <AdminEditPatientDialog
        profileId="profile-1"
        open
        onClose={onClose}
        onSuccess={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Xem ảnh CCCD mặt trước" }));
    expect(await screen.findByRole("dialog", { name: "Xem ảnh CCCD mặt trước" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đóng xem ảnh" }));

    expect(screen.queryByRole("dialog", { name: "Xem ảnh CCCD mặt trước" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Chỉnh sửa hồ sơ bệnh nhân/ })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should not show an eye icon when a document photo is missing", async () => {
    getPatientRecordById.mockResolvedValue({
      record: {
        ...record,
        id_document_storage_path: null,
        id_document_back_storage_path: null,
        card_front_storage_path: null,
      },
      error: null,
    });

    render(
      <AdminEditPatientDialog
        profileId="profile-1"
        open
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    await waitFor(() => expect(screen.getByText("Ảnh giấy tờ")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Xem ảnh/ })).not.toBeInTheDocument();
  });
});
