import {
  ChecklistItemChangeResponse,
  RemoteMyChecklistCommandDataSource,
  RemoteChecklistItemChangeApiError,
  RemoteChecklistItemChangeRequestAbortedError,
  RemoteMyChecklistCreationApiError,
  RemoteMyChecklistCreationRequestAbortedError,
} from "../data-source/remoteMyChecklistCommandDataSource";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

export interface MyChecklistCommandRepository {
  changeItemCategory(
    itemId: number,
    categoryId: number,
    signal?: AbortSignal,
  ): Promise<void>;
  changeItemTitle(
    itemId: number,
    title: string,
    signal?: AbortSignal,
  ): Promise<void>;
  ensureChecklist(signal?: AbortSignal): Promise<void>;
  reconcileMissingChecklist(signal?: AbortSignal): Promise<void>;
}

export type ChecklistItemChangeFailureReason =
  | "forbidden"
  | "invalid-request"
  | "category-not-changeable"
  | "category-not-found"
  | "item-not-found"
  | "title-not-changeable"
  | "unknown";

export class ChecklistItemChangeError extends Error {
  constructor(
    readonly reason: ChecklistItemChangeFailureReason,
    message = "할 일을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ChecklistItemChangeError";
  }
}

function getChecklistItemChangeFailureReason(
  error: RemoteChecklistItemChangeApiError,
): ChecklistItemChangeFailureReason {
  if (error.status === 400 || error.errorCode === 101) {
    return "invalid-request";
  }

  if (error.status === 403 || error.errorCode === 203) {
    return "forbidden";
  }

  if (error.errorCode === 304) {
    return "item-not-found";
  }

  if (error.errorCode === 305) {
    return "category-not-found";
  }

  if (error.errorCode === 404) {
    return "category-not-changeable";
  }

  if (error.errorCode === 405) {
    return "title-not-changeable";
  }

  return "unknown";
}

function getSafeMutationMessage(
  error: RemoteChecklistItemChangeApiError,
): string | undefined {
  const message = error.message.trim();

  return message.length > 0 && message.length <= 200 ? message : undefined;
}

export class MyChecklistCreationError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트를 생성하지 못했습니다.", options);
    this.name = "MyChecklistCreationError";
  }
}

async function getChecklistExists(
  queryRepository: MyChecklistQueryRepository,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    return (await queryRepository.getChecklist(signal)).exists;
  } catch (error) {
    if (
      error instanceof MyChecklistAuthenticationRequiredError ||
      error instanceof MyChecklistRequestAbortedError
    ) {
      throw error;
    }

    throw new MyChecklistCreationError({ cause: error });
  }
}

export function createMyChecklistCommandRepository(
  dataSource: RemoteMyChecklistCommandDataSource,
  queryRepository: MyChecklistQueryRepository,
): MyChecklistCommandRepository {
  let hasConfirmedChecklist = false;

  const changeChecklistItem = async (
    request: () => Promise<ChecklistItemChangeResponse>,
    applyUpdate: (changedItem: ChecklistItemChangeResponse) => boolean,
  ): Promise<void> => {
    try {
      const changedItem = await request();
      const updateApplied = applyUpdate(changedItem);

      if (!updateApplied) {
        throw new ChecklistItemChangeError("unknown");
      }
    } catch (error) {
      if (
        error instanceof RemoteChecklistItemChangeApiError &&
        (error.status === 401 || error.errorCode === 201)
      ) {
        throw new MyChecklistAuthenticationRequiredError({ cause: error });
      }

      if (error instanceof RemoteChecklistItemChangeRequestAbortedError) {
        throw new MyChecklistRequestAbortedError({ cause: error });
      }

      if (error instanceof ChecklistItemChangeError) {
        throw error;
      }

      if (error instanceof RemoteChecklistItemChangeApiError) {
        throw new ChecklistItemChangeError(
          getChecklistItemChangeFailureReason(error),
          getSafeMutationMessage(error),
          { cause: error },
        );
      }

      throw new ChecklistItemChangeError("unknown", undefined, {
        cause: error,
      });
    }
  };

  const ensureChecklist = async (signal?: AbortSignal): Promise<void> => {
    if (hasConfirmedChecklist) {
      return;
    }

    if (await getChecklistExists(queryRepository, signal)) {
      hasConfirmedChecklist = true;
      return;
    }

    try {
      await dataSource.createChecklist(signal);
      hasConfirmedChecklist = true;
      queryRepository.invalidate();
    } catch (error) {
      if (
        error instanceof RemoteMyChecklistCreationApiError &&
        (error.status === 401 || error.errorCode === 201)
      ) {
        throw new MyChecklistAuthenticationRequiredError({ cause: error });
      }

      const didAnotherRequestCreateChecklist =
        error instanceof RemoteMyChecklistCreationApiError &&
        error.status === 409 &&
        error.errorCode === 402;

      if (didAnotherRequestCreateChecklist) {
        queryRepository.invalidate();

        if (await getChecklistExists(queryRepository, signal)) {
          hasConfirmedChecklist = true;
          return;
        }
      }

      if (error instanceof RemoteMyChecklistCreationRequestAbortedError) {
        throw new MyChecklistRequestAbortedError({ cause: error });
      }

      throw new MyChecklistCreationError({ cause: error });
    }
  };

  return {
    changeItemCategory(itemId, categoryId, signal) {
      if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
        return Promise.reject(
          new ChecklistItemChangeError(
            "invalid-request",
            "카테고리를 선택해주세요.",
          ),
        );
      }

      return changeChecklistItem(
        () =>
          dataSource.changeChecklistItemCategory(itemId, categoryId, signal),
        (changedItem) =>
          queryRepository.applyItemCategoryUpdate(
            itemId,
            changedItem.categoryId,
          ),
      );
    },
    async changeItemTitle(itemId, title, signal) {
      const normalizedTitle = title.trim();

      if (normalizedTitle.length === 0) {
        throw new ChecklistItemChangeError(
          "invalid-request",
          "할 일 제목을 입력해주세요.",
        );
      }

      if (normalizedTitle.length > 50) {
        throw new ChecklistItemChangeError(
          "invalid-request",
          "할 일 제목은 50자 이하로 입력해주세요.",
        );
      }

      return changeChecklistItem(
        () =>
          dataSource.changeChecklistItemTitle(itemId, normalizedTitle, signal),
        (changedItem) =>
          queryRepository.applyItemTitleUpdate(itemId, changedItem.title),
      );
    },
    ensureChecklist,
    async reconcileMissingChecklist(signal) {
      hasConfirmedChecklist = false;
      queryRepository.invalidate();
      await ensureChecklist(signal);
    },
  };
}
