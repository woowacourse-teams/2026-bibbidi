import { createContext, ReactNode, useContext, useMemo } from "react";

import { createMyChecklistRepositoriesDependency } from "./checklistDependencies";
import { MyChecklistCommandRepository } from "./repository/myChecklistCommandRepository";
import { MyChecklistQueryRepository } from "./repository/myChecklistQueryRepository";

interface MyChecklistProviderProps {
  children: ReactNode;
  sessionKey: string;
}

interface MyChecklistScope {
  commandRepository: MyChecklistCommandRepository;
  queryRepository: MyChecklistQueryRepository;
}

const MyChecklistContext = createContext<MyChecklistScope | undefined>(
  undefined,
);

export function MyChecklistProvider({
  children,
  sessionKey,
}: MyChecklistProviderProps) {
  const scope = useMemo(() => {
    if (sessionKey.length === 0) {
      throw new Error("체크리스트 세션 키가 필요합니다.");
    }

    return createMyChecklistRepositoriesDependency();
  }, [sessionKey]);

  return (
    <MyChecklistContext.Provider value={scope}>
      {children}
    </MyChecklistContext.Provider>
  );
}

export function useMyChecklistQueryRepository() {
  const scope = useContext(MyChecklistContext);

  if (!scope) {
    throw new Error(
      "useMyChecklistQueryRepository는 MyChecklistProvider 안에서 사용해야 합니다.",
    );
  }

  return scope.queryRepository;
}

export function useMyChecklistCommandRepository() {
  const scope = useContext(MyChecklistContext);

  if (!scope) {
    throw new Error(
      "useMyChecklistCommandRepository는 MyChecklistProvider 안에서 사용해야 합니다.",
    );
  }

  return scope.commandRepository;
}
