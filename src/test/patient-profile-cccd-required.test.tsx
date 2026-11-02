import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatientPortalDetail } from "@/types/patient-portal";

const upsert = vi.fn();
const createSignedUrl = vi.fn();
const checkAll = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1", email: "an@example.com" } },
    role: "patient",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useMyPatientProfile", () => ({
  useMyPatientProfile: () => ({
    data: record,
    isLoading: false,
    isError: false,
  }),
  hasPatientRecord: (profile: PatientPortalDetail | null | undefined) =>
    Boolean(profile?.id),
}));

vi.mock("@/hooks/useDuplicateCheck", () => ({
  useDuplicateCheck: () => ({
    dupState: { cccdMatchId: null, phoneMatchId: null, nameDobMatchId: null },
    bypassed: { phone: false, nameDob: false },
    checking: false,
    isBlocked: false,
    hasUnbypassedWarning: false,
    checkCccd: vi.fn(),
    checkPhone: vi.fn(),
    checkNameDob: vi.fn(),
    checkAll: (...args: unknown[]) => checkAll(...args),
    bypassPhone: vi.fn(),
    bypassNameDob: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }),
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => createSignedUrl(...args),
        upload: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import PatientProfileDialog from "@/components/patient/PatientProfileDialog";

const record: PatientPortalDetail = {
  id: "profile-1",
  user_id: "user-1",
  legal_first_name: "An",
  legal_last_name: "Nguyễn",
  full_name: "Nguyễn An",
  date_of_birth: "1990-01-15",
  preferred_pronouns: "Nam",
  email_address: "an@example.com",
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

function renderProfile() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PatientProfileDialog open onOpenChange={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PatientProfileDialog CCCD required fields and document preview", () => {
  beforeEach(() => {
    upsert.mockReset();
    createSignedUrl.mockReset();
    checkAll.mockReset();
    upsert.mockResolvedValue({ error: null });
    checkAll.mockResolvedValue({
      cccdMatchId: null,
      phoneMatchId: null,
      nameDobMatchId: null,
    });
    createSignedUrl.mockImplementation((path: string) =>
      Promise.resolve({ data: { signedUrl: `https://cdn.example/${path}` }, error: null }),
    );
  });

  it("should show a red asterisk on CCCD labels in edit mode", async () => {
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Chỉnh sửa" }));

    expect(document.querySelector('label[for="idNumber"]')?.textContent).toMatch(/Số CCCD\/ID\s*\*/);
    expect(document.querySelector('label[for="expirationDate"]')?.textContent).toMatch(/Ngày hết hạn\s*\*/);
    expect(document.querySelector('label[for="residentialAddress"]')?.textContent).toMatch(/Địa chỉ\s*\*/);
    expect(document.querySelector('label[for="issuedDate"]')?.textContent).toMatch(/Ngày cấp\s*\*/);
    expect(document.querySelector('label[for="issuer"]')?.textContent).toMatch(/Nơi cấp\s*\*/);
  });

  it("should show Vui lòng nhập under empty CCCD fields and not save", async () => {
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => {
      expect(document.getElementById("expirationDate")?.parentElement).toHaveTextContent("Vui lòng nhập");
      expect(document.getElementById("residentialAddress")?.parentElement).toHaveTextContent("Vui lòng nhập");
      expect(document.getElementById("issuedDate")?.parentElement).toHaveTextContent("Vui lòng nhập");
      expect(document.getElementById("issuer")?.parentElement).toHaveTextContent("Vui lòng nhập");
    });
    expect(upsert).not.toHaveBeenCalled();
    expect(checkAll).not.toHaveBeenCalled();
  });

  it("should open a document lightbox from view mode without closing the profile sheet", async () => {
    const onOpenChange = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PatientProfileDialog open onOpenChange={onOpenChange} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Xem ảnh CCCD mặt trước" }));

    const lightbox = await screen.findByRole("dialog", { name: "Xem ảnh CCCD mặt trước" });
    expect(lightbox).toHaveClass("pointer-events-auto");

    fireEvent.click(screen.getByRole("button", { name: "Đóng xem ảnh" }));

    expect(screen.queryByRole("dialog", { name: "Xem ảnh CCCD mặt trước" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hồ sơ bệnh nhân/ })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("should open a document lightbox from edit mode", async () => {
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xem ảnh CCCD mặt trước" }));

    expect(await screen.findByRole("dialog", { name: "Xem ảnh CCCD mặt trước" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hồ sơ bệnh nhân/ })).toBeInTheDocument();
  });
});
