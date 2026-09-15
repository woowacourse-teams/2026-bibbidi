import { createContext, ReactNode, useContext, useState } from "react";

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
  return (
    <MyChecklistSessionProvider key={sessionKey}>
      {children}
    </MyChecklistSessionProvider>
  );
}

function MyChecklistSessionProvider({ children }: { children: ReactNode }) {
  const [scope] = useState(createMyChecklistRepositoriesDependency);

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
