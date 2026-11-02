import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PatientPortalDetail } from "@/types/patient-portal";
import PatientRecordDetailPanel from "@/components/patient-records/PatientRecordDetailPanel";

const profile: PatientPortalDetail = {
  id: "profile-1",
  user_id: "user-1",
  legal_first_name: "An",
  legal_last_name: "Nguyễn",
  full_name: "Nguyễn An",
  date_of_birth: "1990-01-15",
  preferred_pronouns: "Nam",
  email_address: null,
  phone_number: "0912345678",
  id_number: "012345678901",
  residential_address: "Hà Nội",
  id_expiration_date: "2030-01-01",
  id_issued_date: "2020-01-01",
  id_issuer: "Cục cảnh sát",
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

describe("PatientRecordDetailPanel document preview", () => {
  it("should open a lightbox when the eye icon is clicked and close only the preview", () => {
    const onReviewed = vi.fn();
    render(
      <PatientRecordDetailPanel
        profile={profile}
        imageUrls={{
          idFront: "https://cdn.example/front.jpg",
          idBack: "https://cdn.example/back.jpg",
          card: "https://cdn.example/bhyt.jpg",
        }}
        onReviewed={onReviewed}
      />,
    );

    expect(screen.getByRole("button", { name: "Xem ảnh CCCD mặt trước" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem ảnh CCCD mặt sau" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem ảnh Thẻ BHYT" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh CCCD mặt trước" }));

    const lightbox = screen.getByRole("dialog", { name: "Xem ảnh CCCD mặt trước" });
    expect(lightbox).toHaveClass("pointer-events-auto");
    expect(screen.getByRole("img", { name: "Xem trước CCCD mặt trước" })).toHaveAttribute(
      "src",
      "https://cdn.example/front.jpg",
    );

    fireEvent.click(screen.getByRole("button", { name: "Đóng xem ảnh" }));

    expect(screen.queryByRole("dialog", { name: "Xem ảnh CCCD mặt trước" })).not.toBeInTheDocument();
    expect(screen.getByText("Ảnh giấy tờ")).toBeInTheDocument();
    expect(onReviewed).not.toHaveBeenCalled();
  });

  it("should not show an eye icon when document photos are missing", () => {
    render(<PatientRecordDetailPanel profile={profile} />);

    expect(screen.queryByRole("button", { name: /Xem ảnh/ })).not.toBeInTheDocument();
  });
});
