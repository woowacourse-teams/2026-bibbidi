import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistCommandRepository,
  MyChecklistModel,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "../../checklist";
import {
  LocalChecklistDataSource,
  LocalChecklistStorageError,
} from "../../preparation/data-source/localChecklistDataSource";
import {
  RemoteChecklistApiError,
  RemoteChecklistDataSource,
} from "../../preparation/data-source/remoteChecklistDataSource";

const MAX_ADD_ATTEMPTS = 2;

export interface ChecklistMigrationRepository {
  migrate(signal?: AbortSignal): Promise<void>;
}

export class ChecklistMigrationAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 병합을 위해 로그인이 필요합니다.", options);
    this.name = "ChecklistMigrationAuthenticationRequiredError";
  }
}

export class ChecklistMigrationRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 병합 요청이 취소됐습니다.", options);
    this.name = "ChecklistMigrationRequestAbortedError";
  }
}

class ChecklistMigrationError extends Error {
  constructor(options?: ErrorOptions) {
    super("로컬 체크리스트를 서버에 병합하지 못했습니다.", options);
    this.name = "ChecklistMigrationError";
  }
}

function getServerCatalogItemIds(checklist: MyChecklistModel): Set<number> {
  return new Set(
    checklist.items.flatMap(({ sourceCatalogItemId }) =>
      sourceCatalogItemId === null ? [] : [sourceCatalogItemId],
    ),
  );
}

function getMissingCatalogItemIds(
  localCatalogItemIds: number[],
  serverCatalogItemIds: Set<number>,
): number[] {
  return localCatalogItemIds.filter(
    (catalogItemId) => !serverCatalogItemIds.has(catalogItemId),
  );
}

function removeConfirmedCatalogItemIds(
  localDataSource: LocalChecklistDataSource,
  catalogItemIds: number[],
): void {
  try {
    localDataSource.removeCatalogItemIds(catalogItemIds);
  } catch (error) {
    if (error instanceof LocalChecklistStorageError) {
      // 서버 반영은 완료됐으므로 로컬 정리 실패가 인증 완료를 막지 않는다.
      return;
    }

    throw error;
  }
}

function throwMigrationError(error: unknown): never {
  if (
    error instanceof ChecklistMigrationAuthenticationRequiredError ||
    error instanceof ChecklistMigrationRequestAbortedError ||
    error instanceof ChecklistMigrationError
  ) {
    throw error;
  }

  if (
    error instanceof MyChecklistAuthenticationRequiredError ||
    (error instanceof RemoteChecklistApiError &&
      (error.status === 401 || error.errorCode === 201))
  ) {
    throw new ChecklistMigrationAuthenticationRequiredError({ cause: error });
  }

  if (error instanceof MyChecklistRequestAbortedError) {
    throw new ChecklistMigrationRequestAbortedError({ cause: error });
  }

  throw new ChecklistMigrationError({ cause: error });
}

export function createChecklistMigrationRepository(
  localDataSource: LocalChecklistDataSource,
  remoteDataSource: RemoteChecklistDataSource,
  commandRepository: MyChecklistCommandRepository,
  queryRepository: MyChecklistQueryRepository,
): ChecklistMigrationRepository {
  const loadChecklist = async (signal: AbortSignal) => {
    try {
      return await queryRepository.getChecklist(signal);
    } catch (error) {
      return throwMigrationError(error);
    }
  };

  const reconcileWithServer = async (
    localCatalogItemIds: number[],
    signal: AbortSignal,
  ) => {
    const checklist = await loadChecklist(signal);
    const serverCatalogItemIds = getServerCatalogItemIds(checklist);

    removeConfirmedCatalogItemIds(
      localDataSource,
      localCatalogItemIds.filter((catalogItemId) =>
        serverCatalogItemIds.has(catalogItemId),
      ),
    );

    return {
      checklistExists: checklist.exists,
      missingCatalogItemIds: getMissingCatalogItemIds(
        localCatalogItemIds,
        serverCatalogItemIds,
      ),
    };
  };

  const ensureChecklist = async (signal: AbortSignal) => {
    try {
      await commandRepository.ensureChecklist(signal);
    } catch (error) {
      throwMigrationError(error);
    }
  };

  const reconcileMissingChecklist = async (signal: AbortSignal) => {
    try {
      await commandRepository.reconcileMissingChecklist(signal);
    } catch (error) {
      throwMigrationError(error);
    }
  };

  const runMigration = async (signal: AbortSignal): Promise<void> => {
    let localCatalogItemIds: number[];

    try {
      localCatalogItemIds = localDataSource.getCatalogItemIds();
    } catch (error) {
      throwMigrationError(error);
    }

    if (localCatalogItemIds.length === 0) {
      return;
    }

    let serverState = await reconcileWithServer(localCatalogItemIds, signal);

    if (
      !serverState.checklistExists &&
      serverState.missingCatalogItemIds.length > 0
    ) {
      await ensureChecklist(signal);
      serverState = await reconcileWithServer(localCatalogItemIds, signal);
    }

    for (let attempt = 0; attempt < MAX_ADD_ATTEMPTS; attempt += 1) {
      if (serverState.missingCatalogItemIds.length === 0) {
        return;
      }

      try {
        const requestedCatalogItemIds = new Set(
          serverState.missingCatalogItemIds,
        );
        const addedCatalogItemIds = await remoteDataSource.addCatalogItemIds(
          serverState.missingCatalogItemIds,
          signal,
        );

        removeConfirmedCatalogItemIds(
          localDataSource,
          addedCatalogItemIds.filter((catalogItemId) =>
            requestedCatalogItemIds.has(catalogItemId),
          ),
        );

        queryRepository.invalidate();
        serverState = await reconcileWithServer(localCatalogItemIds, signal);
      } catch (error) {
        if (signal.aborted) {
          throw new ChecklistMigrationRequestAbortedError({ cause: error });
        }

        const isDuplicateConflict =
          error instanceof RemoteChecklistApiError &&
          error.status === 409 &&
          error.errorCode === 403;
        const isChecklistMissing =
          error instanceof RemoteChecklistApiError &&
          error.status === 404 &&
          error.errorCode === 303;

        if (
          (!isDuplicateConflict && !isChecklistMissing) ||
          attempt + 1 >= MAX_ADD_ATTEMPTS
        ) {
          throwMigrationError(error);
        }

        if (isChecklistMissing) {
          await reconcileMissingChecklist(signal);
        } else {
          queryRepository.invalidate();
        }

        serverState = await reconcileWithServer(localCatalogItemIds, signal);
      }
    }

    if (serverState.missingCatalogItemIds.length > 0) {
      throw new ChecklistMigrationError();
    }
  };

  return {
    migrate(signal) {
      return runMigration(signal ?? new AbortController().signal);
    },
  };
}
