import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarDays } from "lucide-react";
import { ProfileDetailField } from "@/components/account/ProfileDetailField";
import {
  looksLikeEncryptedToken,
  sanitizeSensitiveDisplay,
  sanitizeSensitiveInput,
} from "@/lib/crypto";
import { formatStdTestDisplay } from "@/lib/patient-sexual-health-api";

const SAMPLE_PHONE_TOKEN =
  "ES9jja+EZ1sUoqjp0vZZ3GmKdjAUO2m4mB8y8hjwha0c2aezPAA=";
const SAMPLE_CCCD_TOKEN =
  "EFIABL54/AND/6zBizeU473vtezvu/U7tefqOEuf/1yTabcd+xyz=";
const SAMPLE_ADDRESS_TOKEN =
  "7wFjEiH7NVLvJX4fIkzy/Rmx8p+o1ml4rxQgSlKXLKChJnOonHsU0PBqisZDambRfR/xLTDaBqAohtUCB0/ns4PDx+E+uABC=";

describe("looksLikeEncryptedToken", () => {
  it("should detect AES-GCM base64 ciphertext used for PII", () => {
    expect(looksLikeEncryptedToken(SAMPLE_PHONE_TOKEN)).toBe(true);
    expect(looksLikeEncryptedToken(SAMPLE_CCCD_TOKEN)).toBe(true);
    expect(looksLikeEncryptedToken(SAMPLE_ADDRESS_TOKEN)).toBe(true);
  });

  it("should leave plaintext patient fields alone", () => {
    expect(looksLikeEncryptedToken("0901234567")).toBe(false);
    expect(looksLikeEncryptedToken("079199001234")).toBe(false);
    expect(looksLikeEncryptedToken("Anh/Nam")).toBe(false);
    expect(looksLikeEncryptedToken("123 Nguyễn Huệ, Q.1, TP.HCM")).toBe(false);
    expect(looksLikeEncryptedToken(null)).toBe(false);
    expect(looksLikeEncryptedToken("")).toBe(false);
  });
});

describe("sanitizeSensitiveDisplay", () => {
  it("should hide ciphertext tokens instead of rendering them", () => {
    expect(sanitizeSensitiveDisplay(SAMPLE_PHONE_TOKEN)).toBe("—");
    expect(sanitizeSensitiveDisplay(SAMPLE_CCCD_TOKEN)).toBe("—");
    expect(sanitizeSensitiveDisplay(SAMPLE_ADDRESS_TOKEN)).toBe("—");
    expect(sanitizeSensitiveDisplay("[Lỗi giải mã]")).toBe("—");
  });

  it("should keep decrypted plaintext", () => {
    expect(sanitizeSensitiveDisplay("0901234567")).toBe("0901234567");
    expect(sanitizeSensitiveDisplay("079199001234")).toBe("079199001234");
    expect(sanitizeSensitiveDisplay("123 Nguyễn Huệ, Q.1")).toBe(
      "123 Nguyễn Huệ, Q.1",
    );
  });
});

describe("sanitizeSensitiveInput", () => {
  it("should clear ciphertext so patient forms do not show tokens", () => {
    expect(
      sanitizeSensitiveInput("5fuXoyhVQOTmLlyHN2Sn2fWeD6EinuMypZRFoxlirBY="),
    ).toBe("");
    expect(
      sanitizeSensitiveInput(
        "beTnMvZ3xqs2tEOakxUWCoZvlzs8wuzu6Gu+qAIH4ooS9Fil5kQ9ja8w+u+oPzISQ==",
      ),
    ).toBe("");
  });

  it("should keep plaintext for editing", () => {
    expect(sanitizeSensitiveInput("Mẹ")).toBe("Mẹ");
    expect(sanitizeSensitiveInput("Đồng tính nữ")).toBe("Đồng tính nữ");
  });
});

describe("formatStdTestDisplay", () => {
  it("should hide encrypted STD result tokens", () => {
    expect(
      formatStdTestDisplay(
        null,
        "5fuXoyhVQOTmLlyHN2Sn2fWeD6EinuMypZRFoxlirBY=",
      ),
    ).toBe("—");
  });
});

describe("ProfileDetailField", () => {
  it("should not render encrypted tokens in the patient account UI", () => {
    render(
      <ProfileDetailField
        icon={CalendarDays}
        label="Số điện thoại"
        value={SAMPLE_PHONE_TOKEN}
      />,
    );

    expect(screen.queryByText(SAMPLE_PHONE_TOKEN)).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should still render plaintext values", () => {
    render(
      <ProfileDetailField
        icon={CalendarDays}
        label="Số điện thoại"
        value="0901234567"
      />,
    );

    expect(screen.getByText("0901234567")).toBeInTheDocument();
  });
});
