import { ReactNode, useEffect, useMemo } from "react";

import {
  AccountSetupCompletionAuthenticationRequiredError,
  AccountSetupCompletionRequestAbortedError,
  createAccountSetupCompletionRepository,
} from "../account-setup";
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
    authState.status === "authenticated" ||
    authState.status === "synchronizing" ||
    authState.status === "accountSetupRequired"
      ? `authenticated:${authState.user.nickname}`
      : authState.status;

  return (
    <MyChecklistProvider sessionKey={sessionKey}>
      <PostAuthenticationChecklistCoordinator />
      {children}
    </MyChecklistProvider>
  );
}

function PostAuthenticationChecklistCoordinator() {
  const {
    authState,
    completeAuthentication,
    failAuthentication,
    refreshAuth,
    requireAccountSetup,
  } = useAuth();
  const commandRepository = useMyChecklistCommandRepository();
  const queryRepository = useMyChecklistQueryRepository();
  const accountSetupCompletionRepository = useMemo(
    () => createAccountSetupCompletionRepository(queryRepository),
    [queryRepository],
  );
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
      let completion;

      try {
        completion = await accountSetupCompletionRepository.getCompletion(
          controller.signal,
        );
      } catch (error) {
        if (
          !isActive ||
          error instanceof AccountSetupCompletionRequestAbortedError
        ) {
          return;
        }

        if (
          error instanceof AccountSetupCompletionAuthenticationRequiredError
        ) {
          refreshAuth();
          return;
        }

        failAuthentication(user);
        return;
      }

      if (!isActive) {
        return;
      }

      if (completion.status === "required") {
        requireAccountSetup(user);
        return;
      }

      try {
        await migration.migrate(completion.checklist, controller.signal);

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
    accountSetupCompletionRepository,
    completeAuthentication,
    failAuthentication,
    migration,
    refreshAuth,
    requireAccountSetup,
  ]);

  return null;
}
