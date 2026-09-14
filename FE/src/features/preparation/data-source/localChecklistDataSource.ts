const LOCAL_CHECKLIST_STORAGE_KEY = "bibbidi:preparation-checklist";
const LOCAL_CHECKLIST_SCHEMA_VERSION = 1;

interface LocalChecklistStorageValue {
  catalogItemIds: number[];
  version: typeof LOCAL_CHECKLIST_SCHEMA_VERSION;
}

export class LocalChecklistStorageError extends Error {
  constructor(
    readonly operation: "read" | "write",
    options?: ErrorOptions,
  ) {
    super("로컬 체크리스트 저장소를 사용할 수 없습니다.", options);
    this.name = "LocalChecklistStorageError";
  }
}

export interface LocalChecklistDataSource {
  getCatalogItemIds(): number[];
  setCatalogItemIds(catalogItemIds: number[]): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidCatalogItemId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function parseStorageValue(serializedValue: string): number[] {
  let value: unknown;

  try {
    value = JSON.parse(serializedValue);
  } catch {
    return [];
  }

  if (
    !isRecord(value) ||
    value.version !== LOCAL_CHECKLIST_SCHEMA_VERSION ||
    !Array.isArray(value.catalogItemIds)
  ) {
    return [];
  }

  return [...new Set(value.catalogItemIds.filter(isValidCatalogItemId))];
}

export function createLocalChecklistDataSource(
  getStorage: () => Storage,
): LocalChecklistDataSource {
  return {
    getCatalogItemIds() {
      let serializedValue: string | null;

      try {
        serializedValue = getStorage().getItem(LOCAL_CHECKLIST_STORAGE_KEY);
      } catch (error) {
        throw new LocalChecklistStorageError("read", { cause: error });
      }

      return serializedValue === null ? [] : parseStorageValue(serializedValue);
    },
    setCatalogItemIds(catalogItemIds) {
      const storageValue: LocalChecklistStorageValue = {
        version: LOCAL_CHECKLIST_SCHEMA_VERSION,
        catalogItemIds: [
          ...new Set(catalogItemIds.filter(isValidCatalogItemId)),
        ],
      };

      try {
        getStorage().setItem(
          LOCAL_CHECKLIST_STORAGE_KEY,
          JSON.stringify(storageValue),
        );
      } catch (error) {
        throw new LocalChecklistStorageError("write", { cause: error });
      }
    },
  };
}

export const localChecklistDataSource = createLocalChecklistDataSource(
  () => window.localStorage,
);
