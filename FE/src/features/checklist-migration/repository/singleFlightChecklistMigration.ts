import { MyChecklistModel } from "../../checklist";
import {
  ChecklistMigrationRepository,
  ChecklistMigrationRequestAbortedError,
} from "./checklistMigrationRepository";

interface MigrationRun {
  controller: AbortController;
  promise: Promise<void>;
  subscribers: Set<symbol>;
}

export function createSingleFlightChecklistMigration(
  repository: ChecklistMigrationRepository,
): ChecklistMigrationRepository {
  let migrationRun: MigrationRun | undefined;

  const startMigration = (initialChecklist: MyChecklistModel): MigrationRun => {
    const controller = new AbortController();
    const run = {
      controller,
      promise: repository.migrate(initialChecklist, controller.signal),
      subscribers: new Set<symbol>(),
    };

    migrationRun = run;
    run.promise.then(
      () => {
        if (migrationRun === run) {
          migrationRun = undefined;
        }
      },
      () => {
        if (migrationRun === run) {
          migrationRun = undefined;
        }
      },
    );
    return run;
  };

  const subscribe = (run: MigrationRun, signal?: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      const subscriber = Symbol("checklist-migration-subscriber");
      let isSettled = false;

      const cleanup = () => {
        run.subscribers.delete(subscriber);
        signal?.removeEventListener("abort", handleAbort);
      };

      const handleAbort = () => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        cleanup();
        reject(new ChecklistMigrationRequestAbortedError());

        if (run.subscribers.size === 0 && migrationRun === run) {
          queueMicrotask(() => {
            if (run.subscribers.size === 0 && migrationRun === run) {
              migrationRun = undefined;
              run.controller.abort();
            }
          });
        }
      };

      run.subscribers.add(subscriber);

      if (signal?.aborted) {
        handleAbort();
        return;
      }

      signal?.addEventListener("abort", handleAbort, { once: true });
      run.promise.then(
        () => {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            resolve();
          }
        },
        (error: unknown) => {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            reject(error);
          }
        },
      );
    });

  return {
    migrate(initialChecklist, signal) {
      if (signal?.aborted) {
        return Promise.reject(new ChecklistMigrationRequestAbortedError());
      }

      return subscribe(
        migrationRun ?? startMigration(initialChecklist),
        signal,
      );
    },
  };
}
