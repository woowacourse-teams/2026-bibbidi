import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import {
  rememberLoginReturnPath,
  readLoginReturnPath,
} from "../features/auth/model/loginReturnPath";
import { OnboardingPage } from "./OnboardingPage";

const refreshAuth = vi.hoisted(() => vi.fn());
vi.mock("../features/auth", () => ({
  useAuth: () => ({ endAuthentication: vi.fn(), refreshAuth }),
  useLogout: () => ({
    isLoggingOut: false,
    submit: vi.fn(),
    errorMessage: null,
  }),
}));
vi.mock("../features/onboarding/OnboardingFeature", () => ({
  OnboardingFeature: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>가입 완료</button>
  ),
}));

afterEach(() => {
  window.sessionStorage.clear();
  refreshAuth.mockClear();
});

it("가입 완료 후 보관한 게임 복귀 주소를 소비해 이동한다", async () => {
  rememberLoginReturnPath("?returnTo=%2Fbalance-game");
  render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/balance-game" element={<h1>게임 복귀</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "가입 완료" }));
  expect(
    await screen.findByRole("heading", { name: "게임 복귀" }),
  ).toBeTruthy();
  expect(refreshAuth).toHaveBeenCalledOnce();
  expect(readLoginReturnPath()).toBeNull();
});
