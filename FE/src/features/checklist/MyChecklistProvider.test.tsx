import { ReactNode, useEffect, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MyChecklistProvider,
  useMyChecklistCommandRepository,
  useMyChecklistQueryRepository,
} from "./MyChecklistProvider";
import { MyChecklistCommandRepository } from "./repository/myChecklistCommandRepository";
import { MyChecklistQueryRepository } from "./repository/myChecklistQueryRepository";

interface RepositoryObserverProps {
  onRepositories: (
    commandRepository: MyChecklistCommandRepository,
    queryRepository: MyChecklistQueryRepository,
  ) => void;
}

function RepositoryObserver({ onRepositories }: RepositoryObserverProps) {
  const commandRepository = useMyChecklistCommandRepository();
  const queryRepository = useMyChecklistQueryRepository();

  useEffect(() => {
    onRepositories(commandRepository, queryRepository);
  }, [commandRepository, onRepositories, queryRepository]);

  return null;
}

function SessionStateProbe() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((value) => value + 1)}>{count}</button>
  );
}

function renderProvider(children: ReactNode, sessionKey: string) {
  return (
    <MyChecklistProvider sessionKey={sessionKey}>
      {children}
    </MyChecklistProvider>
  );
}

describe("MyChecklistProvider", () => {
  it("같은 인증 세션에서는 저장소를 유지하고 세션이 바뀌면 교체한다", () => {
    const observeRepositories = vi.fn();
    const firstSession = "authenticated:first-user";
    const secondSession = "authenticated:second-user";
    const observer = (
      <RepositoryObserver onRepositories={observeRepositories} />
    );
    const { rerender } = render(renderProvider(observer, firstSession));
    const [firstCommandRepository, firstQueryRepository] =
      observeRepositories.mock.calls[0];

    rerender(renderProvider(observer, firstSession));
    expect(observeRepositories).toHaveBeenCalledOnce();

    rerender(renderProvider(observer, secondSession));
    expect(observeRepositories).toHaveBeenCalledTimes(2);
    expect(observeRepositories.mock.calls[1][0]).not.toBe(
      firstCommandRepository,
    );
    expect(observeRepositories.mock.calls[1][1]).not.toBe(firstQueryRepository);

    rerender(renderProvider(observer, "guest"));
    expect(observeRepositories).toHaveBeenCalledTimes(3);
    expect(observeRepositories.mock.calls[2][0]).not.toBe(
      observeRepositories.mock.calls[1][0],
    );
    expect(observeRepositories.mock.calls[2][1]).not.toBe(
      observeRepositories.mock.calls[1][1],
    );
  });

  it("Provider 밖에서 공통 저장소를 요청하면 사용 오류를 알린다", () => {
    expect(() =>
      render(<RepositoryObserver onRepositories={vi.fn()} />),
    ).toThrowError(/MyChecklistProvider/);
  });

  it("인증 세션이 바뀌어도 하위 UI 상태를 직접 초기화하지 않는다", () => {
    const { rerender } = render(
      renderProvider(<SessionStateProbe />, "authenticated:first-user"),
    );

    fireEvent.click(screen.getByRole("button", { name: "0" }));
    expect(screen.getByRole("button", { name: "1" })).toBeTruthy();

    rerender(
      renderProvider(<SessionStateProbe />, "authenticated:second-user"),
    );
    expect(screen.getByRole("button", { name: "1" })).toBeTruthy();
  });
});
