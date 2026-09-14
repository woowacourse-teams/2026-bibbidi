import {
  LocalChecklistDataSource,
  LocalChecklistStorageError,
} from "../data-source/localChecklistDataSource";
import {
  RemoteChecklistApiError,
  RemoteChecklistDataSource,
} from "../data-source/remoteChecklistDataSource";
import { PreparationAudience } from "../model/preparationRoadmap";
import { PreparationAuthenticationRequiredError } from "./preparationErrors";

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
  addLocalCatalogItemIds(catalogItemIds: string[]): string[];
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
): ChecklistRepository {
  return {
    addLocalCatalogItemIds(catalogItemIds) {
      const catalogItemIdNumbers = catalogItemIds.map(toCatalogItemIdNumber);

      return runWithPersistenceError(() => {
        const currentCatalogItemIds = localDataSource.getCatalogItemIds();
        const nextCatalogItemIds = [
          ...new Set([...currentCatalogItemIds, ...catalogItemIdNumbers]),
        ];

        if (catalogItemIdNumbers.length > 0) {
          localDataSource.setCatalogItemIds(nextCatalogItemIds);
        }

        return nextCatalogItemIds.map(String);
      });
    },
    async getCatalogItemIds(audience, signal) {
      if (audience === "guest") {
        return runWithPersistenceError(() =>
          localDataSource.getCatalogItemIds().map(String),
        );
      }

      try {
        return (await remoteDataSource.getCatalogItemIds(signal)).map(String);
      } catch (error) {
        if (
          error instanceof RemoteChecklistApiError &&
          error.status === 401 &&
          error.errorCode === 201
        ) {
          throw new PreparationAuthenticationRequiredError();
        }

        if (
          error instanceof RemoteChecklistApiError &&
          error.status === 404 &&
          error.errorCode === 303
        ) {
          return [];
        }

        throw error;
      }
    },
  };
}
