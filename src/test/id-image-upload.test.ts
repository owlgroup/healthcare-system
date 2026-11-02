import { describe, expect, it } from "vitest";
import { ID_IMAGE_TYPE_ERROR, isAllowedIdImageFile } from "@/lib/id-image-upload";

function file(name: string, type: string) {
  return new File(["x"], name, { type });
}

describe("isAllowedIdImageFile", () => {
  it("should accept JPEG and PNG images", () => {
    expect(isAllowedIdImageFile(file("front.jpg", "image/jpeg"))).toBe(true);
    expect(isAllowedIdImageFile(file("front.jpeg", "image/jpeg"))).toBe(true);
    expect(isAllowedIdImageFile(file("front.png", "image/png"))).toBe(true);
  });

  it("should reject PDF by MIME type (PAT-PRP-005)", () => {
    expect(isAllowedIdImageFile(file("cccd.pdf", "application/pdf"))).toBe(false);
  });

  it("should reject PDF by file extension when MIME is empty", () => {
    expect(isAllowedIdImageFile(file("cccd.pdf", ""))).toBe(false);
  });

  it("should accept JPG/PNG by extension when MIME is empty", () => {
    expect(isAllowedIdImageFile(file("front.jpg", ""))).toBe(true);
    expect(isAllowedIdImageFile(file("front.jpeg", ""))).toBe(true);
    expect(isAllowedIdImageFile(file("front.png", ""))).toBe(true);
  });

  it("should reject other image and document types", () => {
    expect(isAllowedIdImageFile(file("front.webp", "image/webp"))).toBe(false);
    expect(isAllowedIdImageFile(file("front.gif", "image/gif"))).toBe(false);
    expect(isAllowedIdImageFile(file("front.bmp", "image/bmp"))).toBe(false);
    expect(isAllowedIdImageFile(file("front.heic", "image/heic"))).toBe(false);
  });
});

describe("ID_IMAGE_TYPE_ERROR", () => {
  it("should use the PAT-PRP-005 warning copy", () => {
    expect(ID_IMAGE_TYPE_ERROR).toBe("Chỉ chấp nhận file ảnh (JPG, PNG)");
  });
});
