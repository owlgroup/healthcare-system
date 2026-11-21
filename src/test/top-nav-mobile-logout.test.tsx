import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TopNav from "@/components/TopNav";

const { portalLogout, navigate } = vi.hoisted(() => ({
  portalLogout: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
}));

vi.mock("@/lib/portal-auth-api", () => ({ portalLogout }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { user: { email: "b@example.com", user_metadata: {} } }, role: "patient" }),
}));
vi.mock("@/hooks/useMyPatientProfile", () => ({
  useMyPatientProfile: () => ({ data: { full_name: "TRẦN THỊ B" } }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

describe("TopNav mobile menu", () => {
  it("should log out when the logout button in the mobile menu is clicked", async () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <TopNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở menu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Đăng xuất" }));

    await waitFor(() => expect(portalLogout).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith(expect.any(String), { replace: true });
  });
});
