import {
  LocalChecklistDataSource,
  LocalChecklistStorageError,
} from "../data-source/localChecklistDataSource";
import {
  RemoteChecklistApiError,
  RemoteChecklistDataSource,
} from "../data-source/remoteChecklistDataSource";
import {
  MyChecklistCommandRepository,
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
} from "../../checklist";
import { PreparationAudience } from "../model/preparationRoadmap";
import {
  PreparationAuthenticationRequiredError,
  PreparationChecklistAdditionError,
  PreparationChecklistNotFoundError,
  PreparationDuplicateChecklistItemError,
} from "./preparationErrors";

export class ChecklistPersistenceError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트를 로컬에 저장하지 못했습니다.", options);
    this.name = "ChecklistPersistenceError";
  }
}

export class InvalidChecklistCatalogItemIdError extends Error {
  constructor(catalogItemId: string) {
    super(`체크리스트 항목 ID가 올바르지 않습니다: ${catalogItemId}`);
    this.name = "InvalidChecklistCatalogItemIdError";
  }
}

export interface ChecklistRepository {
  addCatalogItemIds(
    audience: PreparationAudience,
    catalogItemIds: string[],
    signal?: AbortSignal,
  ): Promise<string[]>;
  getCatalogItemIds(
    audience: PreparationAudience,
    signal?: AbortSignal,
  ): Promise<string[]>;
}

function toCatalogItemIdNumber(catalogItemId: string): number {
  const value = Number(catalogItemId);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidChecklistCatalogItemIdError(catalogItemId);
  }

  return value;
}

function runWithPersistenceError<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof LocalChecklistStorageError) {
      throw new ChecklistPersistenceError({ cause: error });
    }

    throw error;
  }
}

export function createChecklistRepository(
  localDataSource: LocalChecklistDataSource,
  remoteDataSource: RemoteChecklistDataSource,
  checklistCommandRepository: MyChecklistCommandRepository,
  checklistQueryRepository: MyChecklistQueryRepository,
): ChecklistRepository {
  const throwCatalogItemAdditionError = (error: unknown): never => {
    if (error instanceof RemoteChecklistApiError) {
      if (error.status === 401 || error.errorCode === 201) {
        throw new PreparationAuthenticationRequiredError();
      }

      if (error.status === 404 && error.errorCode === 303) {
        throw new PreparationChecklistNotFoundError(error.message, {
          cause: error,
        });
      }

      if (error.status === 409 && error.errorCode === 403) {
        throw new PreparationDuplicateChecklistItemError(error.message, {
          cause: error,
        });
      }

      throw new PreparationChecklistAdditionError(error.message, {
        cause: error,
      });
    }

    throw new PreparationChecklistAdditionError(undefined, {
      cause: error,
    });
  };

  const runChecklistCommand = async (
    operation: () => Promise<void>,
  ): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      if (error instanceof MyChecklistAuthenticationRequiredError) {
        throw new PreparationAuthenticationRequiredError();
      }

      throw new PreparationChecklistAdditionError(undefined, {
        cause: error,
      });
    }
  };

  const addAuthenticatedCatalogItemIds = async (
    catalogItemIds: number[],
    signal?: AbortSignal,
  ): Promise<number[]> => {
    await runChecklistCommand(() =>
      checklistCommandRepository.ensureChecklist(signal),
    );

    try {
      const addedCatalogItemIds = await remoteDataSource.addCatalogItemIds(
        catalogItemIds,
        signal,
      );
      checklistQueryRepository.invalidate();

      return addedCatalogItemIds;
    } catch (error) {
      const isChecklistMissing =
        error instanceof RemoteChecklistApiError &&
        error.status === 404 &&
        error.errorCode === 303;

      if (!isChecklistMissing) {
        return throwCatalogItemAdditionError(error);
      }

      await runChecklistCommand(() =>
        checklistCommandRepository.reconcileMissingChecklist(signal),
      );

      try {
        const addedCatalogItemIds = await remoteDataSource.addCatalogItemIds(
          catalogItemIds,
          signal,
        );
        checklistQueryRepository.invalidate();

        return addedCatalogItemIds;
      } catch (retryError) {
        return throwCatalogItemAdditionError(retryError);
      }
    }
  };

  return {
    async addCatalogItemIds(audience, catalogItemIds, signal) {
      const catalogItemIdNumbers = catalogItemIds.map(toCatalogItemIdNumber);

      if (audience === "guest") {
        return runWithPersistenceError(() => {
          const currentCatalogItemIds = localDataSource.getCatalogItemIds();
          const currentCatalogItemIdSet = new Set(currentCatalogItemIds);
          const addedCatalogItemIds = [
            ...new Set(
              catalogItemIdNumbers.filter(
                (catalogItemId) => !currentCatalogItemIdSet.has(catalogItemId),
              ),
            ),
          ];
          const nextCatalogItemIds = [
            ...currentCatalogItemIds,
            ...addedCatalogItemIds,
          ];

          if (addedCatalogItemIds.length > 0) {
            localDataSource.setCatalogItemIds(nextCatalogItemIds);
          }

          return addedCatalogItemIds.map(String);
        });
      }

      return (
        await addAuthenticatedCatalogItemIds(catalogItemIdNumbers, signal)
      ).map(String);
    },
    async getCatalogItemIds(audience, signal) {
      if (audience === "guest") {
        return runWithPersistenceError(() =>
          localDataSource.getCatalogItemIds().map(String),
        );
      }

      try {
        const checklist = await checklistQueryRepository.getChecklist(signal);

        return [
          ...new Set(
            checklist.items.flatMap((item) =>
              item.sourceCatalogItemId === null
                ? []
                : [String(item.sourceCatalogItemId)],
            ),
          ),
        ];
      } catch (error) {
        if (error instanceof MyChecklistAuthenticationRequiredError) {
          throw new PreparationAuthenticationRequiredError();
        }

        throw error;
      }
    },
  };
}
