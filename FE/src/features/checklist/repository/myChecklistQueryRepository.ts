import {
  RemoteMyChecklistApiError,
  RemoteMyChecklistDataSource,
  RemoteMyChecklistRequestAbortedError,
} from "../data-source/remoteMyChecklistDataSource";
import { MyChecklistItemModel, MyChecklistModel } from "../model/myChecklist";

export interface MyChecklistQueryRepository {
  applyAddedItems(items: readonly MyChecklistItemModel[]): void;
  getChecklist(signal?: AbortSignal): Promise<MyChecklistModel>;
  getRevision(): number;
  invalidate(): void;
  subscribe(listener: () => void): () => void;
}

export class MyChecklistAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("로그인이 필요합니다.", options);
    this.name = "MyChecklistAuthenticationRequiredError";
  }
}

export class MyChecklistLoadError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트를 불러오지 못했습니다.", options);
    this.name = "MyChecklistLoadError";
  }
}

export class MyChecklistRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청이 취소됐습니다.", options);
    this.name = "MyChecklistRequestAbortedError";
  }
}

interface InFlightRequest {
  controller: AbortController;
  promise: Promise<MyChecklistModel>;
  subscribers: Set<symbol>;
}

async function loadChecklist(
  dataSource: RemoteMyChecklistDataSource,
  signal: AbortSignal,
): Promise<MyChecklistModel> {
  try {
    return await dataSource.getChecklist(signal);
  } catch (error) {
    if (
      error instanceof RemoteMyChecklistApiError &&
      error.status === 404 &&
      error.errorCode === 303
    ) {
      return { exists: false, items: [] };
    }

    if (
      error instanceof RemoteMyChecklistApiError &&
      (error.status === 401 || error.errorCode === 201)
    ) {
      throw new MyChecklistAuthenticationRequiredError({ cause: error });
    }

    if (error instanceof RemoteMyChecklistRequestAbortedError) {
      throw new MyChecklistRequestAbortedError({ cause: error });
    }

    throw new MyChecklistLoadError({ cause: error });
  }
}

export function createMyChecklistQueryRepository(
  dataSource: RemoteMyChecklistDataSource,
): MyChecklistQueryRepository {
  let cachedResult: MyChecklistModel | undefined;
  let inFlightRequest: InFlightRequest | undefined;
  let revision = 0;
  const listeners = new Set<() => void>();

  const notify = () => {
    revision += 1;

    for (const listener of [...listeners]) {
      listener();
    }
  };

  const setCachedResult = (checklist: MyChecklistModel) => {
    cachedResult = checklist;
    notify();
  };

  const invalidate = () => {
    cachedResult = undefined;
    inFlightRequest?.controller.abort();
    inFlightRequest = undefined;
  };

  const startRequest = (): InFlightRequest => {
    const controller = new AbortController();
    const request: InFlightRequest = {
      controller,
      promise: loadChecklist(dataSource, controller.signal),
      subscribers: new Set(),
    };

    request.promise.then(
      (checklist) => {
        if (inFlightRequest === request) {
          inFlightRequest = undefined;
          setCachedResult(checklist);
        }
      },
      () => {
        if (inFlightRequest === request) {
          inFlightRequest = undefined;
        }
      },
    );

    inFlightRequest = request;

    return request;
  };

  const subscribe = (
    request: InFlightRequest,
    signal?: AbortSignal,
  ): Promise<MyChecklistModel> =>
    new Promise((resolve, reject) => {
      const subscriber = Symbol("my-checklist-subscriber");
      let isSettled = false;

      const cleanup = () => {
        request.subscribers.delete(subscriber);
        signal?.removeEventListener("abort", handleAbort);
      };

      const handleAbort = () => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        cleanup();
        reject(new MyChecklistRequestAbortedError());

        if (request.subscribers.size === 0 && inFlightRequest === request) {
          queueMicrotask(() => {
            if (request.subscribers.size === 0 && inFlightRequest === request) {
              inFlightRequest = undefined;
              request.controller.abort();
            }
          });
        }
      };

      request.subscribers.add(subscriber);

      if (signal?.aborted) {
        handleAbort();
        return;
      }

      signal?.addEventListener("abort", handleAbort, { once: true });
      request.promise.then(
        (checklist) => {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            resolve(checklist);
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
    applyAddedItems(items) {
      inFlightRequest?.controller.abort();
      inFlightRequest = undefined;

      const currentItems = cachedResult?.items ?? [];
      const knownItemIds = new Set(currentItems.map((item) => item.id));
      const addedItems = items.filter((item) => {
        if (knownItemIds.has(item.id)) {
          return false;
        }

        knownItemIds.add(item.id);
        return true;
      });

      if (cachedResult?.exists === true && addedItems.length === 0) {
        return;
      }

      setCachedResult({
        exists: true,
        items: [...currentItems, ...addedItems],
      });
    },
    getChecklist(signal) {
      if (signal?.aborted) {
        return Promise.reject(new MyChecklistRequestAbortedError());
      }

      if (cachedResult) {
        return Promise.resolve(cachedResult);
      }

      const request = inFlightRequest ?? startRequest();

      return subscribe(request, signal);
    },
    getRevision() {
      return revision;
    },
    invalidate,
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
