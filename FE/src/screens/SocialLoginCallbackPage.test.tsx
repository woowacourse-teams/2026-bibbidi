import { render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "../test/memoryNavigation";
import { afterEach, expect, it, vi } from "vitest";
import { rememberLoginReturnPath } from "../features/auth/model/loginReturnPath";
import { LoginCallbackContext } from "../features/social-login/view/callbackState";
import { SocialLoginCallbackPage } from "./SocialLoginCallbackPage";

afterEach(() => sessionStorage.clear());

it("OAuth 주소를 복귀 화면으로 바꾸고 인증 정보를 방문 기록에 남기지 않는다", async () => {
  rememberLoginReturnPath("?returnTo=%2Fcalendar%3FdateFor%3D101");
  const setCallback = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/auth/kakao",
        element: <SocialLoginCallbackPage provider="kakao" />,
      },
      { path: "/calendar", element: <main>캘린더</main> },
    ],
    { initialEntries: ["/auth/kakao?code=abc&state=xyz"] },
  );
  render(
    <LoginCallbackContext value={{ setCallback }}>
      <RouterProvider router={router} />
    </LoginCallbackContext>,
  );
  await waitFor(() => expect(router.state.location.pathname).toBe("/calendar"));
  expect(router.state.location.search).toBe("?dateFor=101");
  expect(router.state.location.state).toBeNull();
  expect(setCallback).toHaveBeenCalledExactlyOnceWith({
    returnTo: "/calendar?dateFor=101",
    provider: "kakao",
    search: "?code=abc&state=xyz",
  });
});
