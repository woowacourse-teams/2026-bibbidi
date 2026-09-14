import { ReactNode, useEffect } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MyChecklistQueryProvider,
  useMyChecklistQueryRepository,
} from "./MyChecklistQueryProvider";
import { MyChecklistQueryRepository } from "./repository/myChecklistQueryRepository";

interface RepositoryObserverProps {
  onRepository: (repository: MyChecklistQueryRepository) => void;
}

function RepositoryObserver({ onRepository }: RepositoryObserverProps) {
  const repository = useMyChecklistQueryRepository();

  useEffect(() => {
    onRepository(repository);
  }, [onRepository, repository]);

  return null;
}

function renderProvider(children: ReactNode, sessionKey: string) {
  return (
    <MyChecklistQueryProvider sessionKey={sessionKey}>
      {children}
    </MyChecklistQueryProvider>
  );
}

describe("MyChecklistQueryProvider", () => {
  it("같은 인증 세션에서는 저장소를 유지하고 세션이 바뀌면 교체한다", () => {
    const observeRepository = vi.fn();
    const firstSession = "authenticated:first-user";
    const secondSession = "authenticated:second-user";
    const observer = <RepositoryObserver onRepository={observeRepository} />;
    const { rerender } = render(renderProvider(observer, firstSession));
    const firstRepository = observeRepository.mock.calls[0][0];

    rerender(renderProvider(observer, firstSession));
    expect(observeRepository).toHaveBeenCalledOnce();

    rerender(renderProvider(observer, secondSession));
    expect(observeRepository).toHaveBeenCalledTimes(2);
    expect(observeRepository.mock.calls[1][0]).not.toBe(firstRepository);

    rerender(renderProvider(observer, "guest"));
    expect(observeRepository).toHaveBeenCalledTimes(3);
    expect(observeRepository.mock.calls[2][0]).not.toBe(
      observeRepository.mock.calls[1][0],
    );
  });

  it("Provider 밖에서 공통 저장소를 요청하면 사용 오류를 알린다", () => {
    expect(() =>
      render(<RepositoryObserver onRepository={vi.fn()} />),
    ).toThrowError(/MyChecklistQueryProvider/);
  });
});
