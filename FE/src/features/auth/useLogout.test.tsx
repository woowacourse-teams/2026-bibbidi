import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLogout } from "./useLogout";

afterEach(() => {
  vi.unstubAllGlobals();
});

function LogoutHarness({ onSuccess }: { onSuccess: () => void }) {
  const { errorMessage, isLoggingOut, submit } = useLogout({ onSuccess });

  return (
    <>
      <button onClick={submit} type="button">
        로그아웃
      </button>
      {isLoggingOut ? <p>처리 중</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </>
  );
}

describe("useLogout", () => {
  it("컴포넌트가 사라지면 요청을 취소하고 늦은 성공을 반영하지 않는다", async () => {
    const onSuccess = vi.fn();
    const request: {
      resolve?: (response: Response) => void;
      signal?: AbortSignal;
    } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        request.signal = init.signal ?? undefined;
        return new Promise<Response>((resolve) => {
          request.resolve = resolve;
        });
      }),
    );

    const { unmount } = render(<LogoutHarness onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(screen.getByText("처리 중")).toBeTruthy();

    unmount();
    expect(request.signal?.aborted).toBe(true);
    await act(async () => {
      request.resolve?.(new Response(null, { status: 204 }));
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
