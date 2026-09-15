import { describe, expect, it, vi } from "vitest";

import {
  ChecklistMigrationRepository,
  ChecklistMigrationRequestAbortedError,
} from "./checklistMigrationRepository";
import { createSingleFlightChecklistMigration } from "./singleFlightChecklistMigration";

function createDeferredRepository() {
  let resolveMigration: (() => void) | undefined;
  let underlyingSignal: AbortSignal | undefined;
  const repository: ChecklistMigrationRepository = {
    migrate: vi.fn(
      (signal) =>
        new Promise<void>((resolve, reject) => {
          resolveMigration = resolve;
          underlyingSignal = signal;
          signal?.addEventListener("abort", () => {
            reject(new ChecklistMigrationRequestAbortedError());
          });
        }),
    ),
  };

  return {
    repository,
    resolve: () => resolveMigration?.(),
    signal: () => underlyingSignal,
  };
}

describe("createSingleFlightChecklistMigration", () => {
  it("동시 실행은 하나의 병합 요청을 공유한다", async () => {
    const deferred = createDeferredRepository();
    const migration = createSingleFlightChecklistMigration(deferred.repository);

    const first = migration.migrate();
    const second = migration.migrate();

    expect(deferred.repository.migrate).toHaveBeenCalledOnce();
    deferred.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
  });

  it("완료된 병합은 이후 실행과 공유하지 않는다", async () => {
    const repository: ChecklistMigrationRepository = {
      migrate: vi.fn().mockResolvedValue(undefined),
    };
    const migration = createSingleFlightChecklistMigration(repository);

    await migration.migrate();
    await migration.migrate();

    expect(repository.migrate).toHaveBeenCalledTimes(2);
  });

  it("일부 구독자만 취소하면 공유 병합 요청을 유지한다", async () => {
    const deferred = createDeferredRepository();
    const migration = createSingleFlightChecklistMigration(deferred.repository);
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = migration.migrate(firstController.signal);
    const second = migration.migrate(secondController.signal);
    firstController.abort();

    await expect(first).rejects.toBeInstanceOf(
      ChecklistMigrationRequestAbortedError,
    );
    expect(deferred.signal()?.aborted).toBe(false);

    deferred.resolve();
    await expect(second).resolves.toBeUndefined();
  });

  it("마지막 구독자가 취소되면 공유 병합 요청도 취소한다", async () => {
    const deferred = createDeferredRepository();
    const migration = createSingleFlightChecklistMigration(deferred.repository);
    const controller = new AbortController();

    const result = migration.migrate(controller.signal);
    controller.abort();

    await expect(result).rejects.toBeInstanceOf(
      ChecklistMigrationRequestAbortedError,
    );
    await vi.waitFor(() => expect(deferred.signal()?.aborted).toBe(true));
  });

  it("이미 취소된 호출은 병합 요청을 시작하지 않는다", async () => {
    const deferred = createDeferredRepository();
    const migration = createSingleFlightChecklistMigration(deferred.repository);
    const controller = new AbortController();
    controller.abort();

    await expect(migration.migrate(controller.signal)).rejects.toBeInstanceOf(
      ChecklistMigrationRequestAbortedError,
    );
    expect(deferred.repository.migrate).not.toHaveBeenCalled();
  });
});
