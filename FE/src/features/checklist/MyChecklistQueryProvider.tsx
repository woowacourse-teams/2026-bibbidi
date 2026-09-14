import { createContext, ReactNode, useContext, useMemo } from "react";

import { createMyChecklistQueryRepositoryDependency } from "./checklistDependencies";
import { MyChecklistQueryRepository } from "./repository/myChecklistQueryRepository";

interface MyChecklistQueryProviderProps {
  children: ReactNode;
  sessionKey: string;
}

interface MyChecklistQueryScope {
  repository: MyChecklistQueryRepository;
  sessionKey: string;
}

const MyChecklistQueryContext = createContext<
  MyChecklistQueryScope | undefined
>(undefined);

export function MyChecklistQueryProvider({
  children,
  sessionKey,
}: MyChecklistQueryProviderProps) {
  const scope = useMemo(
    () => ({
      repository: createMyChecklistQueryRepositoryDependency(),
      sessionKey,
    }),
    [sessionKey],
  );

  return (
    <MyChecklistQueryContext.Provider value={scope}>
      {children}
    </MyChecklistQueryContext.Provider>
  );
}

export function useMyChecklistQueryRepository() {
  const scope = useContext(MyChecklistQueryContext);

  if (!scope) {
    throw new Error(
      "useMyChecklistQueryRepository는 MyChecklistQueryProvider 안에서 사용해야 합니다.",
    );
  }

  return scope.repository;
}
