import { ReactNode, useEffect, useMemo } from "react";

import { useAuth } from "../auth";
import {
  MyChecklistProvider,
  useMyChecklistCommandRepository,
  useMyChecklistQueryRepository,
} from "../checklist";
import { localChecklistDataSource } from "../preparation/data-source/localChecklistDataSource";
import { remoteChecklistDataSource } from "../preparation/data-source/remoteChecklistDataSource";
import {
  ChecklistMigrationAuthenticationRequiredError,
  ChecklistMigrationRequestAbortedError,
  createChecklistMigrationRepository,
} from "./repository/checklistMigrationRepository";
import { createSingleFlightChecklistMigration } from "./repository/singleFlightChecklistMigration";

interface ChecklistMigrationProviderProps {
  children: ReactNode;
}

export function ChecklistMigrationProvider({
  children,
}: ChecklistMigrationProviderProps) {
  const { authState } = useAuth();
  const sessionKey =
    authState.status === "authenticated" || authState.status === "synchronizing"
      ? `authenticated:${authState.user.nickname}`
      : authState.status;

  return (
    <MyChecklistProvider sessionKey={sessionKey}>
      <ChecklistMigrationCoordinator />
      {children}
    </MyChecklistProvider>
  );
}

function ChecklistMigrationCoordinator() {
  const { authState, completeAuthentication, refreshAuth } = useAuth();
  const commandRepository = useMyChecklistCommandRepository();
  const queryRepository = useMyChecklistQueryRepository();
  const migrationRepository = useMemo(
    () =>
      createChecklistMigrationRepository(
        localChecklistDataSource,
        remoteChecklistDataSource,
        commandRepository,
        queryRepository,
      ),
    [commandRepository, queryRepository],
  );
  const migration = useMemo(
    () => createSingleFlightChecklistMigration(migrationRepository),
    [migrationRepository],
  );

  useEffect(() => {
    if (authState.status !== "synchronizing") {
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    const user = authState.user;

    migration.migrate(controller.signal).then(
      () => {
        if (isActive) {
          completeAuthentication(user);
        }
      },
      (error: unknown) => {
        if (
          !isActive ||
          error instanceof ChecklistMigrationRequestAbortedError
        ) {
          return;
        }

        if (error instanceof ChecklistMigrationAuthenticationRequiredError) {
          refreshAuth();
          return;
        }

        completeAuthentication(user);
      },
    );

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [authState, completeAuthentication, migration, refreshAuth]);

  return null;
}
