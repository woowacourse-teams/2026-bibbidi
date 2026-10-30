import { render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it } from "vitest";
import { rememberLoginReturnPath } from "../features/auth/model/loginReturnPath";
import { SocialLoginCallbackPage } from "./SocialLoginCallbackPage";

afterEach(() => sessionStorage.clear());
it("OAuth 주소를 복귀 화면으로 바꾸고 결과 처리 정보를 모달에 전달한다", async () => {
  rememberLoginReturnPath("?returnTo=%2Fcalendar%3FdateFor%3D101");
  const router = createMemoryRouter(
    [
      { path: "/auth/:provider", Component: SocialLoginCallbackPage },
      { path: "/calendar", element: <main>캘린더</main> },
    ],
    { initialEntries: ["/auth/kakao?code=abc&state=xyz"] },
  );
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(router.state.location.pathname).toBe("/calendar"));
  expect(router.state.location.search).toBe("?dateFor=101");
  expect(router.state.location.state.loginModal).toEqual({
    returnTo: "/calendar?dateFor=101",
    callback: { provider: "kakao", search: "?code=abc&state=xyz" },
  });
});
