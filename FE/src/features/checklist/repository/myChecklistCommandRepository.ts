import {
  RemoteMyChecklistCommandDataSource,
  RemoteMyChecklistCreationApiError,
  RemoteMyChecklistCreationRequestAbortedError,
} from "../data-source/remoteMyChecklistCommandDataSource";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

export interface MyChecklistCommandRepository {
  ensureChecklist(signal?: AbortSignal): Promise<void>;
  reconcileMissingChecklist(signal?: AbortSignal): Promise<void>;
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
    ensureChecklist,
    async reconcileMissingChecklist(signal) {
      hasConfirmedChecklist = false;
      queryRepository.invalidate();
      await ensureChecklist(signal);
    },
  };
}
