import { ReactNode, useEffect, useMemo } from "react";

import { useAuth } from "../auth";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
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
      ? `authenticated:${authState.user.id}`
      : authState.status;

  return (
    <MyChecklistProvider sessionKey={sessionKey}>
      <PostAuthenticationChecklistCoordinator />
      {children}
    </MyChecklistProvider>
  );
}

function PostAuthenticationChecklistCoordinator() {
  const { authState, completeAuthentication, failAuthentication, refreshAuth } =
    useAuth();
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

    const synchronizeChecklist = async () => {
      let checklist;

      try {
        await commandRepository.ensureChecklist(controller.signal);
        checklist = await queryRepository.getChecklist(controller.signal);
      } catch (error) {
        if (!isActive || error instanceof MyChecklistRequestAbortedError) {
          return;
        }

        if (error instanceof MyChecklistAuthenticationRequiredError) {
          refreshAuth();
          return;
        }

        failAuthentication(user);
        return;
      }

      if (!isActive) {
        return;
      }

      try {
        await migration.migrate(checklist, controller.signal);

        if (isActive) {
          completeAuthentication(user);
        }
      } catch (error) {
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
      }
    };

    void synchronizeChecklist();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    authState,
    commandRepository,
    queryRepository,
    completeAuthentication,
    failAuthentication,
    migration,
    refreshAuth,
  ]);

  return null;
}
