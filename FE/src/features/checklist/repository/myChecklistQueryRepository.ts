import {
  RemoteMyChecklistApiError,
  RemoteMyChecklistDataSource,
  RemoteMyChecklistRequestAbortedError,
} from "../data-source/remoteMyChecklistDataSource";
import {
  MyChecklistAppointmentModel,
  MyChecklistItemModel,
  MyChecklistModel,
} from "../model/myChecklist";

export interface MyChecklistQueryRepository {
  applyAddedItems(items: readonly MyChecklistItemModel[]): void;
  applyAppointmentCompletionUpdate(
    itemId: number,
    appointmentId: number,
    isDone: boolean,
    checklistItemDone: boolean,
  ): boolean;
  applyAppointmentRemoval(itemId: number, appointmentId: number): boolean;
  applyAppointmentUpdate(
    itemId: number,
    appointment: MyChecklistAppointmentModel,
  ): boolean;
  applyItemCategoryUpdate(itemId: number, categoryId: number): boolean;
  applyItemTitleUpdate(itemId: number, title: string): boolean;
  getChecklist(signal?: AbortSignal): Promise<MyChecklistModel>;
  getRevision(): number;
  invalidate(): void;
  refresh(signal?: AbortSignal): Promise<MyChecklistModel>;
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
  result?: MyChecklistModel;
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
  let hasPendingAdditionResult = false;
  let revision = 0;
  const listeners = new Set<() => void>();
  const pendingAddedItems = new Map<number, MyChecklistItemModel>();

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

  const mergeAddedItems = (
    checklist: MyChecklistModel,
    items: Iterable<MyChecklistItemModel>,
  ): MyChecklistModel => {
    const knownItemIds = new Set(checklist.items.map((item) => item.id));
    const addedItems = [...items].filter((item) => {
      if (knownItemIds.has(item.id)) {
        return false;
      }

      knownItemIds.add(item.id);
      return true;
    });

    return {
      exists: true,
      items: [...checklist.items, ...addedItems],
    };
  };

  const mergePendingAddedItems = (
    checklist: MyChecklistModel,
  ): MyChecklistModel => {
    if (!hasPendingAdditionResult) {
      return checklist;
    }

    const mergedChecklist = mergeAddedItems(
      checklist,
      pendingAddedItems.values(),
    );
    hasPendingAdditionResult = false;
    pendingAddedItems.clear();

    return mergedChecklist;
  };

  const invalidate = () => {
    cachedResult = undefined;
    inFlightRequest?.controller.abort();
    inFlightRequest = undefined;
    hasPendingAdditionResult = false;
    pendingAddedItems.clear();
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
          const mergedChecklist = mergePendingAddedItems(checklist);
          request.result = mergedChecklist;
          inFlightRequest = undefined;
          setCachedResult(mergedChecklist);
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
            resolve(cachedResult ?? request.result ?? checklist);
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

  const applyItemUpdate = (
    itemId: number,
    update: (item: MyChecklistItemModel) => MyChecklistItemModel | null,
  ): boolean => {
    if (!cachedResult) {
      return false;
    }

    const itemIndex = cachedResult.items.findIndex(
      (item) => item.id === itemId,
    );

    if (itemIndex < 0) {
      return false;
    }

    const updatedItem = update(cachedResult.items[itemIndex]);

    if (updatedItem === null) {
      return false;
    }

    const nextItems = [...cachedResult.items];
    nextItems[itemIndex] = updatedItem;
    setCachedResult({ ...cachedResult, items: nextItems });

    return true;
  };

  const getChecklist = (signal?: AbortSignal): Promise<MyChecklistModel> => {
    if (signal?.aborted) {
      return Promise.reject(new MyChecklistRequestAbortedError());
    }

    if (cachedResult) {
      return Promise.resolve(cachedResult);
    }

    const request = inFlightRequest ?? startRequest();

    return subscribe(request, signal);
  };

  return {
    applyAddedItems(items) {
      if (!cachedResult && inFlightRequest) {
        hasPendingAdditionResult = true;

        for (const item of items) {
          if (!pendingAddedItems.has(item.id)) {
            pendingAddedItems.set(item.id, item);
          }
        }

        return;
      }

      const nextChecklist = mergeAddedItems(
        cachedResult ?? { exists: false, items: [] },
        items,
      );

      if (
        cachedResult?.exists === true &&
        nextChecklist.items.length === cachedResult.items.length
      ) {
        return;
      }

      setCachedResult(nextChecklist);
    },
    applyAppointmentCompletionUpdate(
      itemId,
      appointmentId,
      isDone,
      checklistItemDone,
    ) {
      return applyItemUpdate(itemId, (item) => {
        if (
          !item.appointments.some(
            (appointment) => appointment.id === appointmentId,
          )
        ) {
          return null;
        }

        return {
          ...item,
          appointments: item.appointments.map((appointment) =>
            appointment.id === appointmentId
              ? { ...appointment, isDone }
              : appointment,
          ),
          status: checklistItemDone
            ? "done"
            : item.status === "done"
              ? "continue"
              : item.status,
        };
      });
    },
    applyAppointmentRemoval(itemId, appointmentId) {
      return applyItemUpdate(itemId, (item) => {
        if (
          !item.appointments.some(
            (appointment) => appointment.id === appointmentId,
          )
        ) {
          return null;
        }

        return {
          ...item,
          appointments: item.appointments.filter(
            (appointment) => appointment.id !== appointmentId,
          ),
        };
      });
    },
    applyAppointmentUpdate(itemId, appointment) {
      return applyItemUpdate(itemId, (item) => {
        if (
          !item.appointments.some(
            (currentAppointment) => currentAppointment.id === appointment.id,
          )
        ) {
          return null;
        }

        return {
          ...item,
          appointments: item.appointments.map((currentAppointment) =>
            currentAppointment.id === appointment.id
              ? appointment
              : currentAppointment,
          ),
        };
      });
    },
    applyItemCategoryUpdate(itemId, categoryId) {
      return applyItemUpdate(itemId, (item) => ({ ...item, categoryId }));
    },
    applyItemTitleUpdate(itemId, title) {
      return applyItemUpdate(itemId, (item) => ({ ...item, title }));
    },
    getChecklist,
    getRevision() {
      return revision;
    },
    invalidate,
    refresh(signal) {
      if (signal?.aborted) {
        return getChecklist(signal);
      }

      invalidate();
      notify();

      return getChecklist(signal);
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
