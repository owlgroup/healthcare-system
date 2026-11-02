import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args), warning: vi.fn() },
}));

import UploadCard from "@/components/onboarding/UploadCard";
import { ID_IMAGE_TYPE_ERROR } from "@/lib/id-image-upload";

function renderCard(onFileSelect = vi.fn()) {
  render(
    <UploadCard
      id="identityUploadFront"
      title="Nhấn để tải lên hoặc kéo thả"
      hint="CCCD — mặt trước"
      onFileSelect={onFileSelect}
    />,
  );
  return onFileSelect;
}

describe("UploadCard file type validation (PAT-PRP-005)", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it("should show that only JPG and PNG images are allowed", () => {
    renderCard();
    expect(screen.getByText(/Chỉ chấp nhận file ảnh \(JPG, PNG\)/)).toBeInTheDocument();
  });

  it("should reject a PDF selected via the file input and show a visible error", () => {
    const onFileSelect = renderCard();
    const input = document.getElementById("identityUploadFront") as HTMLInputElement;
    const pdf = new File(["%PDF-1.4"], "cccd.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [pdf] } });

    expect(onFileSelect).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(ID_IMAGE_TYPE_ERROR);
    const popup = screen.getByRole("alertdialog");
    expect(popup).toHaveTextContent("File không hợp lệ");
    expect(popup).toHaveTextContent(ID_IMAGE_TYPE_ERROR);
    expect(screen.getByRole("button", { name: "Đã hiểu" })).toBeInTheDocument();
  });

  it("should reject a PDF dropped onto the CCCD card and show a visible error", () => {
    const onFileSelect = renderCard();
    const dropZone = screen.getByTestId("identityUploadFront-dropzone");
    const pdf = new File(["%PDF-1.4"], "cccd.pdf", { type: "application/pdf" });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [pdf] },
    });

    expect(onFileSelect).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(ID_IMAGE_TYPE_ERROR);
    expect(screen.getByRole("alertdialog")).toHaveTextContent(ID_IMAGE_TYPE_ERROR);
  });

  it("should accept a JPG file via the file input", () => {
    const onFileSelect = renderCard();
    const input = document.getElementById("identityUploadFront") as HTMLInputElement;
    const jpg = new File(["img"], "front.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [jpg] } });

    expect(onFileSelect).toHaveBeenCalledTimes(1);
    expect(onFileSelect.mock.calls[0][0]).toBe(jpg);
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("should show an eye preview after a JPG is selected", () => {
    const jpg = new File(["img"], "front.jpg", { type: "image/jpeg" });
    render(
      <UploadCard
        id="identityUploadFront"
        title="Nhấn để tải lên"
        hint="CCCD — mặt trước (tùy chọn)"
        file={jpg}
        onFileSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh CCCD — mặt trước (tùy chọn)" }));
    expect(screen.getByRole("dialog", { name: "Xem ảnh CCCD — mặt trước (tùy chọn)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đóng xem ảnh" }));
    expect(screen.queryByRole("dialog", { name: "Xem ảnh CCCD — mặt trước (tùy chọn)" })).not.toBeInTheDocument();
  });
});
