import { render, screen } from "@testing-library/react";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { describe, expect, it } from "vitest";
import SoapAiDoctorCompare from "@/components/emr/SoapAiDoctorCompare";
import type { SoapNoteSnapshot } from "@/lib/exam-activity-log";

const UPDATED_AT = "2026-09-16T10:15:00.000Z";
const UPDATED_AT_LABEL = format(parseISO(UPDATED_AT), "dd/MM/yyyy HH:mm", { locale: vi });

const doctorSoap: SoapNoteSnapshot = {
  s_text: "Đau họng 3 ngày",
  o_text: "Họng đỏ",
  a_text: "Viêm họng cấp",
  p_text: "Nghỉ ngơi",
};

const aiSoap: SoapNoteSnapshot = {
  s_text: "Đau họng",
  o_text: "Họng đỏ",
  a_text: "Viêm họng",
  p_text: "Nghỉ ngơi",
};

describe("SoapAiDoctorCompare", () => {
  it("should show AI and doctor columns when both snapshots have text", () => {
    render(
      <SoapAiDoctorCompare
        doctorSoap={doctorSoap}
        aiSoap={aiSoap}
        changedFields={["s_text", "a_text"]}
      />,
    );

    expect(screen.getAllByText("Nháp AI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bác sĩ sửa").length).toBeGreaterThan(0);
    expect(screen.getByText("Đau họng")).toBeInTheDocument();
    expect(screen.getByText("Đau họng 3 ngày")).toBeInTheDocument();
    expect(screen.getByTestId("soap-block-s_text")).toHaveAttribute("data-changed", "true");
    expect(screen.getByTestId("soap-block-o_text")).toHaveAttribute("data-changed", "false");
    expect(screen.getAllByTestId("soap-ai-card")).toHaveLength(4);
    expect(screen.getAllByTestId("soap-doctor-card")).toHaveLength(4);
  });

  it("should still show two columns when aiSoap is null", () => {
    render(<SoapAiDoctorCompare doctorSoap={doctorSoap} aiSoap={null} />);

    expect(screen.getAllByText("Nháp AI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bác sĩ sửa").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("soap-ai-card")).toHaveLength(4);
    expect(screen.getAllByTestId("soap-doctor-card")).toHaveLength(4);
    expect(screen.getByText("Đau họng 3 ngày")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("should show the doctor name on the right column when provided", () => {
    render(
      <SoapAiDoctorCompare
        doctorSoap={doctorSoap}
        aiSoap={aiSoap}
        doctorName="Lê Thị Hồng Xoan"
      />,
    );

    expect(screen.getAllByText("Bác sĩ Lê Thị Hồng Xoan").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bác sĩ sửa")).not.toBeInTheDocument();
  });

  it("should not double-prefix when the name already has BS.", () => {
    render(
      <SoapAiDoctorCompare
        doctorSoap={doctorSoap}
        aiSoap={aiSoap}
        doctorName="BS. Nguyễn A"
      />,
    );

    expect(screen.getAllByText("BS. Nguyễn A").length).toBeGreaterThan(0);
  });

  it("should show the update time under the doctor column", () => {
    render(
      <SoapAiDoctorCompare
        doctorSoap={doctorSoap}
        aiSoap={aiSoap}
        doctorName="Lê Thị Hồng Xoan"
        updatedAt={UPDATED_AT}
      />,
    );

    expect(screen.getAllByText("Bác sĩ Lê Thị Hồng Xoan").length).toBeGreaterThan(0);
    expect(screen.getAllByText(UPDATED_AT_LABEL).length).toBeGreaterThan(0);
  });

  it("should show the AI draft time under the Nháp AI column", () => {
    const aiAt = "2026-09-16T03:00:00.000Z";
    const aiLabel = format(parseISO(aiAt), "dd/MM/yyyy HH:mm", { locale: vi });

    render(
      <SoapAiDoctorCompare
        doctorSoap={doctorSoap}
        aiSoap={aiSoap}
        doctorName="Lê Thị Hồng Xoan"
        updatedAt={UPDATED_AT}
        aiGeneratedAt={aiAt}
      />,
    );

    const header = screen.getByTestId("soap-ai-column-header");
    expect(header).toHaveTextContent("Nháp AI");
    expect(header).toHaveTextContent(aiLabel);
    expect(screen.getByTestId("soap-doctor-column-header")).toHaveTextContent(UPDATED_AT_LABEL);
  });
});
