import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DoctorSignOffDialog from "@/components/emr/DoctorSignOffDialog";
import { PIN_SIGN_LOCK_MESSAGE } from "@/types/emr";
import type { MedicalExamination, SoapIcdCode } from "@/types/emr";

const icd: SoapIcdCode = {
  id: "icd-1",
  exam_id: "exam-1",
  icd_code: "J02.9",
  icd_name: "Viêm họng cấp",
  is_ai_suggested: false,
  ai_confidence: null,
  ai_reason: null,
  confirm_status: "CONFIRMED",
  confirmed_at: "2026-09-16T00:00:00.000Z",
  display_order: 0,
  created_at: "2026-09-16T00:00:00.000Z",
};

const exam: MedicalExamination = {
  id: "exam-1",
  appointment_id: "appt-1",
  patient_id: "user-1",
  doctor_id: "doc-1",
  s_text: "S",
  o_text: "O",
  a_text: "A",
  p_text: "P",
  status: "DRAFT",
  is_addendum: false,
  parent_exam_id: null,
  auto_saved_at: null,
  created_at: "2026-09-16T00:00:00.000Z",
  updated_at: "2026-09-16T00:00:00.000Z",
  icd_codes: [icd],
};

function renderDialog(
  overrides: Partial<ComponentProps<typeof DoctorSignOffDialog>> = {}
) {
  const onSign = vi.fn().mockResolvedValue(null);
  const onClose = vi.fn();
  render(
    <DoctorSignOffDialog
      open
      onClose={onClose}
      onSign={onSign}
      confirmedIcds={[icd]}
      exam={exam}
      {...overrides}
    />
  );
  return { onSign, onClose };
}

describe("DoctorSignOffDialog PIN lock (TC-DLS-010)", () => {
  it("should disable sign until PIN has 6 digits", () => {
    const { onSign } = renderDialog();

    fireEvent.click(screen.getByRole("checkbox"));
    const signButton = screen.getByRole("button", { name: /Ký duyệt hồ sơ/i });
    expect(signButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Mã PIN ký duyệt/i), {
      target: { value: "123" },
    });
    expect(signButton).toBeDisabled();
    fireEvent.click(signButton);
    expect(onSign).not.toHaveBeenCalled();
  });

  it("should lock signing after onSign returns the 10-minute lock message", async () => {
    const onSign = vi.fn().mockResolvedValue(PIN_SIGN_LOCK_MESSAGE);
    render(
      <DoctorSignOffDialog
        open
        onClose={vi.fn()}
        onSign={onSign}
        confirmedIcds={[icd]}
        exam={exam}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText(/Mã PIN ký duyệt/i), {
      target: { value: "111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ký duyệt hồ sơ/i }));

    expect(await screen.findByText(PIN_SIGN_LOCK_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ký duyệt hồ sơ/i })).toBeDisabled();

    onSign.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Ký duyệt hồ sơ/i }));
    expect(onSign).not.toHaveBeenCalled();
  });

  it("should not allow signing when pinLocked is already true", () => {
    const { onSign } = renderDialog({ pinLocked: true });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText(/Mã PIN ký duyệt/i), {
      target: { value: "123456" },
    });
    const signButton = screen.getByRole("button", { name: /Ký duyệt hồ sơ/i });
    expect(signButton).toBeDisabled();
    expect(screen.getByText(PIN_SIGN_LOCK_MESSAGE)).toBeInTheDocument();
    fireEvent.click(signButton);
    expect(onSign).not.toHaveBeenCalled();
  });
});
