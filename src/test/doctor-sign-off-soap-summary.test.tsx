import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DoctorSignOffDialog from "@/components/emr/DoctorSignOffDialog";
import type { SoapFormData } from "@/types/emr";

const soap: SoapFormData = {
  s_text: "Đau đầu 3 ngày",
  o_text: "Huyết áp 120/80",
  a_text: "Đau đầu căng cơ",
  p_text: "Paracetamol 500mg",
};

const renderDialog = (overrides: Partial<SoapFormData> = {}) =>
  render(
    <DoctorSignOffDialog
      open
      onClose={vi.fn()}
      onSign={vi.fn().mockResolvedValue(null)}
      confirmedIcds={[]}
      soap={{ ...soap, ...overrides }}
    />,
  );

describe("DoctorSignOffDialog SOAP summary", () => {
  it("should show all four S, O, A, P sections when they have content", () => {
    renderDialog();

    for (const label of ["S:", "O:", "A:", "P:"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Huyết áp 120/80")).toBeInTheDocument();
    expect(screen.getByText("Đau đầu căng cơ")).toBeInTheDocument();
  });

  it("should mark empty sections instead of hiding them", () => {
    renderDialog({ o_text: "", a_text: "   " });

    expect(screen.getByText("O:")).toBeInTheDocument();
    expect(screen.getByText("A:")).toBeInTheDocument();
    expect(screen.getAllByText("(Chưa nhập)")).toHaveLength(2);
  });
});
