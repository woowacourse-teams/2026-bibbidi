import { ReactNode, useEffect, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppHeaderSummaryRepository } from "../app-header/appHeaderDependencies";
import { usePreparationChecklistRepository } from "../preparation/preparationDependencies";
import { preparationCatalogResponseFixture } from "../preparation/test/fixtures/preparationCatalogResponse.fixture";
import { useChecklistQueryRepository } from "./checklistQueryDependencies";
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

function SharedConsumersProbe() {
  const headerRepository = useAppHeaderSummaryRepository();
  const preparationRepository = usePreparationChecklistRepository();
  const checklistRepository = useChecklistQueryRepository();
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      headerRepository.getSummary(controller.signal),
      preparationRepository.getCatalogItemIds(
        "authenticated",
        controller.signal,
      ),
      checklistRepository.getChecklist("authenticated", controller.signal),
    ]).then(() => setIsComplete(true));

    return () => controller.abort();
  }, [checklistRepository, headerRepository, preparationRepository]);

  return isComplete ? <p>조회 완료</p> : null;
}

function renderProvider(children: ReactNode, sessionKey: string) {
  return (
    <MyChecklistProvider sessionKey={sessionKey}>
      {children}
    </MyChecklistProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("헤더, 준비 목록, 체크리스트 조회 계층이 같은 서버 요청을 공유한다", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/catalog") {
        return Promise.resolve(
          new Response(JSON.stringify(preparationCatalogResponseFixture), {
            status: 200,
          }),
        );
      }

      if (url === "/api/checklists/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              items: [
                {
                  appointments: [],
                  categoryId: 10,
                  id: 10,
                  sourceCatalogItemId: 1001,
                  status: "prev",
                  title: "첫 번째 할 일",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      renderProvider(<SharedConsumersProbe />, "authenticated:shared-user"),
    );

    expect(await screen.findByText("조회 완료")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/checklists/me"),
    ).toHaveLength(1);
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

  it("이전 인증 세션 저장소의 늦은 캐시 변경을 새 세션에 전달하지 않는다", () => {
    const observeRepositories = vi.fn();
    const observer = (
      <RepositoryObserver onRepositories={observeRepositories} />
    );
    const { rerender } = render(
      renderProvider(observer, "authenticated:first-user"),
    );
    const firstQueryRepository = observeRepositories.mock.calls[0][1];

    rerender(renderProvider(observer, "authenticated:second-user"));
    const secondQueryRepository = observeRepositories.mock.calls[1][1];
    const secondSessionListener = vi.fn();
    secondQueryRepository.subscribe(secondSessionListener);

    firstQueryRepository.applyAddedItems([
      {
        appointments: [],
        categoryId: 1,
        id: 10,
        sourceCatalogItemId: 101,
        status: "prev",
        title: "이전 세션 응답",
      },
    ]);

    expect(secondQueryRepository.getRevision()).toBe(0);
    expect(secondSessionListener).not.toHaveBeenCalled();
  });
});
