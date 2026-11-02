import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingBlockedMessage } from "@/lib/appointment-api";

const fetchPatientProfile = vi.fn();
const fetchSpecialties = vi.fn();

vi.mock("@/components/TopNav", () => ({ default: () => <div>TopNav</div> }));
vi.mock("@/components/Sidebar", () => ({ default: () => <div>Sidebar</div> }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    role: "patient",
    isLoading: false,
  }),
}));

vi.mock("@/lib/appointment-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/appointment-api")>(
    "@/lib/appointment-api",
  );
  return {
    ...actual,
    fetchPatientProfile: (...args: unknown[]) => fetchPatientProfile(...args),
    fetchSpecialties: (...args: unknown[]) => fetchSpecialties(...args),
  };
});

import BookAppointment from "@/pages/BookAppointment";

const QA_MESSAGE = bookingBlockedMessage();

function renderPage() {
  return render(
    <MemoryRouter>
      <BookAppointment />
    </MemoryRouter>,
  );
}

describe("BookAppointment unverified profile", () => {
  beforeEach(() => {
    fetchPatientProfile.mockReset();
    fetchSpecialties.mockReset();
    fetchSpecialties.mockResolvedValue([]);
  });

  it("should block the wizard and show the pending-verification message when status is UNVERIFIED", async () => {
    fetchPatientProfile.mockResolvedValue({
      id: "prof-1",
      legal_first_name: "An",
      legal_last_name: "Nguyễn",
      submitted_at: "2026-08-15T00:00:00Z",
      status: "UNVERIFIED",
    });

    renderPage();

    expect(await screen.findByText(QA_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Chọn chuyên khoa bạn muốn đặt khám.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận đặt lịch/ })).not.toBeInTheDocument();
  });

  it("should block the wizard when the patient has no profile", async () => {
    fetchPatientProfile.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(QA_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Chọn chuyên khoa bạn muốn đặt khám.")).not.toBeInTheDocument();
  });

  it("should show the specialty picker when the profile is ACTIVE", async () => {
    fetchPatientProfile.mockResolvedValue({
      id: "prof-1",
      legal_first_name: "An",
      legal_last_name: "Nguyễn",
      submitted_at: "2026-08-15T00:00:00Z",
      status: "ACTIVE",
    });

    renderPage();

    expect(await screen.findByText("Chọn chuyên khoa bạn muốn đặt khám.")).toBeInTheDocument();
    expect(screen.queryByText(QA_MESSAGE)).not.toBeInTheDocument();
  });
});
