import { afterEach, describe, expect, it, vi } from "vitest";

import { createUser, CreateUserApiError } from "./createUser";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createUser", () => {
  it("회원가입 요청을 전송하고 성공 응답을 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 12, nickname: "bibbidi" }), {
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createUser({ nickname: "bibbidi", password: "wish" }),
    ).resolves.toEqual({ id: 12, nickname: "bibbidi" });
    expect(fetchMock).toHaveBeenCalledWith("/api/users", {
      body: JSON.stringify({ nickname: "bibbidi", password: "wish" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("오류 응답을 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 401,
            message: "이미 사용 중인 닉네임입니다.",
          }),
          { status: 409 },
        ),
      ),
    );

    await expect(
      createUser({ nickname: "bibbidi", password: "wish" }),
    ).rejects.toEqual(
      new CreateUserApiError(401, 409, "이미 사용 중인 닉네임입니다."),
    );
  });
});
