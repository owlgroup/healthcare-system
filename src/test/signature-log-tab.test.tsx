import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { format, parseISO } from "date-fns";
import { vi as viLocale } from "date-fns/locale";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSignatureLogs = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/delta-log-api", () => ({
  listSignatureLogs: (...args: unknown[]) => listSignatureLogs(...args),
}));

vi.mock("@/components/admin/delta-log/SignatureDetailDialog", () => ({
  default: ({
    entry,
    open,
  }: {
    entry: { id: string } | null;
    open: boolean;
  }) => (open && entry ? <div>Chi tiết chữ ký {entry.id}</div> : null),
}));

import SignatureLogTab from "@/components/admin/delta-log/SignatureLogTab";

describe("SignatureLogTab", () => {
  beforeEach(() => {
    listSignatureLogs.mockReset();
    listSignatureLogs.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: "sig-1",
          target_type: "medical_examination",
          target_id: "exam-1",
          signed_by: "doc-1",
          signed_by_name: "Lê Thị Hồng Xoan",
          data_hash: "abc",
          ip_address: null,
          user_agent: null,
          signed_at: "2026-09-16T02:06:00.000Z",
          patient_name: "NGUYỄN NHẬT HÀ",
          appointment_id: "appt-1",
          visit_at: "2026-09-16T08:00:00.000Z",
        },
      ],
    });
  });

  it("should show patient name and visit time so signed records are identifiable", async () => {
    render(<SignatureLogTab />);

    expect(
      await screen.findByPlaceholderText("Tìm người ký hoặc bệnh nhân..."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Bệnh nhân")).toBeInTheDocument();
    expect(screen.getAllByText("NGUYỄN NHẬT HÀ").length).toBeGreaterThan(0);

    const visitLabel = format(parseISO("2026-09-16T08:00:00.000Z"), "dd/MM/yy HH:mm", {
      locale: viLocale,
    });
    expect(screen.getAllByText(visitLabel).length).toBeGreaterThan(0);
  });

  it("should open signature detail when clicking a log row", async () => {
    render(<SignatureLogTab />);

    const patientCells = await screen.findAllByText("NGUYỄN NHẬT HÀ");
    fireEvent.click(patientCells[0]);

    await waitFor(() => {
      expect(screen.getByText("Chi tiết chữ ký sig-1")).toBeInTheDocument();
    });
  });
});
