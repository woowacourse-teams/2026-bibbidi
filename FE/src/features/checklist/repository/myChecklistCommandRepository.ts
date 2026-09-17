import {
  ChecklistItemChangeResponse,
  CustomChecklistItemCreationResponse,
  RemoteMyChecklistCommandDataSource,
  RemoteChecklistItemChangeApiError,
  RemoteChecklistItemChangeRequestAbortedError,
  RemoteRemainingAppointmentsApiError,
  RemoteRemainingAppointmentsRequestAbortedError,
  RemoteCustomChecklistItemCreationApiError,
  RemoteCustomChecklistItemCreationRequestAbortedError,
  RemoteMyChecklistCreationApiError,
  RemoteMyChecklistCreationRequestAbortedError,
} from "../data-source/remoteMyChecklistCommandDataSource";
import {
  AppointmentCreationRequest,
  RemoteAppointmentCreationApiError,
  RemoteAppointmentCreationContractError,
  RemoteAppointmentCreationNetworkError,
  RemoteAppointmentCreationRequestAbortedError,
  RemoteAppointmentCreationTimeoutError,
} from "../data-source/remoteAppointmentCreationDataSource";
import {
  ChecklistItemStatus,
  MyChecklistItemModel,
} from "../model/myChecklist";
import {
  AppointmentCreationError,
  AppointmentCreationFailureReason,
} from "../model/appointmentCreation";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

export interface MyChecklistCommandRepository {
  createAppointment(
    itemId: number,
    request: AppointmentCreationRequest,
    signal?: AbortSignal,
  ): Promise<void>;
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
  changeItemStatus(
    itemId: number,
    status: ChecklistItemStatus,
    signal?: AbortSignal,
  ): Promise<void>;
  createCustomItem(
    title: string,
    categoryId: string,
    signal?: AbortSignal,
  ): Promise<void>;
  ensureChecklist(signal?: AbortSignal): Promise<void>;
  hasRemainingAppointments(
    itemId: number,
    signal?: AbortSignal,
  ): Promise<boolean>;
  reconcileMissingChecklist(signal?: AbortSignal): Promise<void>;
}

export type ChecklistItemChangeFailureReason =
  | "forbidden"
  | "invalid-request"
  | "category-not-changeable"
  | "category-not-found"
  | "item-not-found"
  | "refresh-failed"
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

export type CustomChecklistItemCreationFailureReason =
  "category-not-found" | "invalid-request" | "unknown";

export class CustomChecklistItemCreationError extends Error {
  constructor(
    readonly reason: CustomChecklistItemCreationFailureReason,
    message = "할 일을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CustomChecklistItemCreationError";
  }
}

function getChecklistItemChangeFailureReason(error: {
  errorCode: number;
  status: number;
}): ChecklistItemChangeFailureReason {
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

function getSafeMutationMessage(error: {
  message: string;
}): string | undefined {
  const message = error.message.trim();

  return message.length > 0 && message.length <= 200 ? message : undefined;
}

function getCustomChecklistItemCreationFailureReason(
  error: RemoteCustomChecklistItemCreationApiError,
): CustomChecklistItemCreationFailureReason {
  if (error.status === 400 || error.errorCode === 101) {
    return "invalid-request";
  }

  if (error.errorCode === 305) {
    return "category-not-found";
  }

  return "unknown";
}

function toCustomChecklistItemModel(
  item: CustomChecklistItemCreationResponse,
): MyChecklistItemModel {
  return {
    appointments: [],
    categoryId: item.categoryId,
    id: item.id,
    sourceCatalogItemId: null,
    status: item.status,
    title: item.title,
  };
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

  const throwCustomChecklistItemCreationError = (error: unknown): never => {
    if (error instanceof MyChecklistAuthenticationRequiredError) {
      throw error;
    }

    if (
      error instanceof MyChecklistRequestAbortedError ||
      error instanceof RemoteCustomChecklistItemCreationRequestAbortedError
    ) {
      throw new MyChecklistRequestAbortedError({ cause: error });
    }

    if (
      error instanceof RemoteCustomChecklistItemCreationApiError &&
      (error.status === 401 || error.errorCode === 201)
    ) {
      throw new MyChecklistAuthenticationRequiredError({ cause: error });
    }

    if (error instanceof CustomChecklistItemCreationError) {
      throw error;
    }

    if (error instanceof RemoteCustomChecklistItemCreationApiError) {
      const reason = getCustomChecklistItemCreationFailureReason(error);
      const safeMessage =
        reason === "unknown" ? undefined : getSafeMutationMessage(error);

      throw new CustomChecklistItemCreationError(reason, safeMessage, {
        cause: error,
      });
    }

    throw new CustomChecklistItemCreationError("unknown", undefined, {
      cause: error,
    });
  };

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

  const reconcileMissingChecklist = async (
    signal?: AbortSignal,
  ): Promise<void> => {
    hasConfirmedChecklist = false;
    queryRepository.invalidate();
    await ensureChecklist(signal);
  };

  return {
    async createAppointment(itemId, request, signal) {
      try {
        await dataSource.createAppointment(itemId, request, signal);
      } catch (error) {
        if (error instanceof RemoteAppointmentCreationApiError) {
          if (error.status === 401 || error.errorCode === 201) {
            throw new MyChecklistAuthenticationRequiredError({ cause: error });
          }
          const reason: AppointmentCreationFailureReason =
            error.status === 400 || error.errorCode === 101
              ? "invalid-request"
              : error.status === 404 || error.errorCode === 304
                ? "item-not-found"
                : error.status === 403
                  ? "forbidden"
                  : "api";
          throw new AppointmentCreationError(reason, { cause: error });
        }
        if (error instanceof RemoteAppointmentCreationRequestAbortedError) {
          throw new MyChecklistRequestAbortedError({ cause: error });
        }
        if (error instanceof RemoteAppointmentCreationTimeoutError) {
          throw new AppointmentCreationError("timeout", { cause: error });
        }
        if (error instanceof RemoteAppointmentCreationNetworkError) {
          throw new AppointmentCreationError("network", { cause: error });
        }
        if (error instanceof RemoteAppointmentCreationContractError) {
          throw new AppointmentCreationError(
            error.stage === "request" ? "invalid-request" : "contract",
            { cause: error },
          );
        }
        throw new AppointmentCreationError("api", { cause: error });
      }
    },
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
    async changeItemStatus(itemId, status, signal) {
      let didChangeStatus = false;

      try {
        await dataSource.changeChecklistItemStatus(itemId, status, signal);
        didChangeStatus = true;
        await queryRepository.refresh(signal);
      } catch (error) {
        if (error instanceof MyChecklistAuthenticationRequiredError) {
          throw error;
        }

        if (
          error instanceof RemoteChecklistItemChangeApiError &&
          (error.status === 401 || error.errorCode === 201)
        ) {
          throw new MyChecklistAuthenticationRequiredError({ cause: error });
        }

        if (
          error instanceof RemoteChecklistItemChangeRequestAbortedError ||
          error instanceof MyChecklistRequestAbortedError
        ) {
          throw new MyChecklistRequestAbortedError({ cause: error });
        }

        if (didChangeStatus) {
          throw new ChecklistItemChangeError(
            "refresh-failed",
            "상태는 변경됐지만 최신 체크리스트를 불러오지 못했습니다. 다시 조회해주세요.",
            { cause: error },
          );
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
    },
    async createCustomItem(title, categoryId, signal) {
      const normalizedTitle = title.trim();

      if (normalizedTitle.length === 0) {
        throw new CustomChecklistItemCreationError(
          "invalid-request",
          "할 일 제목을 입력해주세요.",
        );
      }

      if (normalizedTitle.length > 50) {
        throw new CustomChecklistItemCreationError(
          "invalid-request",
          "할 일 제목은 50자 이하로 입력해주세요.",
        );
      }

      if (!/^[1-9]\d*$/.test(categoryId)) {
        throw new CustomChecklistItemCreationError(
          "invalid-request",
          "카테고리를 선택해주세요.",
        );
      }

      const categoryIdNumber = Number(categoryId);

      if (!Number.isSafeInteger(categoryIdNumber)) {
        throw new CustomChecklistItemCreationError(
          "invalid-request",
          "카테고리를 선택해주세요.",
        );
      }

      const request = () =>
        dataSource.createCustomChecklistItem(
          normalizedTitle,
          categoryIdNumber,
          signal,
        );
      let createdItem: CustomChecklistItemCreationResponse;

      try {
        createdItem = await request();
      } catch (error) {
        const isChecklistMissing =
          error instanceof RemoteCustomChecklistItemCreationApiError &&
          error.status === 404 &&
          error.errorCode === 303;

        if (!isChecklistMissing) {
          return throwCustomChecklistItemCreationError(error);
        }

        try {
          await reconcileMissingChecklist(signal);
          createdItem = await request();
        } catch (retryError) {
          return throwCustomChecklistItemCreationError(retryError);
        }
      }

      if (signal?.aborted) {
        throw new MyChecklistRequestAbortedError();
      }

      queryRepository.applyAddedItems([
        toCustomChecklistItemModel(createdItem),
      ]);
    },
    ensureChecklist,
    async hasRemainingAppointments(itemId, signal) {
      try {
        return await dataSource.hasRemainingAppointments(itemId, signal);
      } catch (error) {
        if (
          error instanceof RemoteRemainingAppointmentsApiError &&
          (error.status === 401 || error.errorCode === 201)
        ) {
          throw new MyChecklistAuthenticationRequiredError({ cause: error });
        }

        if (error instanceof RemoteRemainingAppointmentsRequestAbortedError) {
          throw new MyChecklistRequestAbortedError({ cause: error });
        }

        if (error instanceof RemoteRemainingAppointmentsApiError) {
          throw new ChecklistItemChangeError(
            getChecklistItemChangeFailureReason(error),
            getSafeMutationMessage(error),
            { cause: error },
          );
        }

        throw new ChecklistItemChangeError(
          "unknown",
          "남은 일정을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
          { cause: error },
        );
      }
    },
    reconcileMissingChecklist,
  };
}
