import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { PreparationAuthenticationRequiredError } from "../repository/preparationErrors";
import type { ChecklistRepository } from "../repository/checklistRepository";
import type { CatalogTaskAdditionState } from "../model/catalogTaskAddition";

interface UseCatalogTaskAdditionOptions {
  allowGuestAddition?: boolean;
  authScope: string;
  isAuthenticated: boolean;
  onAuthenticationRequired: () => void;
  onSuccess?: (catalogItemId: number, itemCount: number) => void;
  repository: ChecklistRepository;
  saveCatalogItem?: (
    catalogItemId: number,
    signal: AbortSignal,
  ) => Promise<string[]>;
  errorMessage?: string;
}

export interface CatalogTaskAdditionController extends CatalogTaskAdditionState {
  add: (catalogItemId: number) => Promise<boolean>;
}

const authenticationErrorMessage =
  "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.";
const additionErrorMessage = "할 일을 추가하지 못했어요. 다시 시도해 주세요.";

interface CatalogTaskAdditionScopedState extends CatalogTaskAdditionState {
  authScope: string;
}

function createEmptyState(authScope: string): CatalogTaskAdditionScopedState {
  return {
    addedCatalogItemIds: [],
    addingCatalogItemIds: [],
    additionErrors: {},
    authScope,
  };
}

export function useCatalogTaskAddition({
  allowGuestAddition = false,
  authScope,
  isAuthenticated,
  onAuthenticationRequired,
  onSuccess,
  repository,
  saveCatalogItem,
  errorMessage = additionErrorMessage,
}: UseCatalogTaskAdditionOptions): CatalogTaskAdditionController {
  const currentAuthScopeRef = useRef(authScope);
  const controllersRef = useRef(
    new Map<number, { authScope: string; controller: AbortController }>(),
  );
  const addedCatalogItemIdsRef = useRef({
    authScope,
    ids: new Set<number>(),
  });
  const [state, setState] = useState<CatalogTaskAdditionScopedState>(() =>
    createEmptyState(authScope),
  );
  const currentState =
    state.authScope === authScope ? state : createEmptyState(authScope);

  useLayoutEffect(() => {
    currentAuthScopeRef.current = authScope;
  }, [authScope]);

  useEffect(() => {
    const controllers = controllersRef.current;

    return () => {
      for (const [catalogItemId, request] of controllers) {
        if (request.authScope === authScope) {
          request.controller.abort();
          controllers.delete(catalogItemId);
        }
      }
    };
  }, [authScope]);

  const add = useCallback(
    async (catalogItemId: number) => {
      if (
        (!isAuthenticated && !allowGuestAddition) ||
        controllersRef.current.get(catalogItemId)?.authScope === authScope
      ) {
        return false;
      }

      if (addedCatalogItemIdsRef.current.authScope !== authScope) {
        addedCatalogItemIdsRef.current = {
          authScope,
          ids: new Set<number>(),
        };
      }

      if (addedCatalogItemIdsRef.current.ids.has(catalogItemId)) {
        return false;
      }

      const controller = new AbortController();
      const request = { authScope, controller };
      controllersRef.current.set(catalogItemId, request);
      setState((current) => {
        const scoped =
          current.authScope === authScope
            ? current
            : createEmptyState(authScope);
        const nextErrors = { ...scoped.additionErrors };
        delete nextErrors[catalogItemId];

        return {
          ...scoped,
          addingCatalogItemIds: [...scoped.addingCatalogItemIds, catalogItemId],
          additionErrors: nextErrors,
        };
      });

      const isCurrentRequest = () =>
        !controller.signal.aborted &&
        currentAuthScopeRef.current === authScope &&
        controllersRef.current.get(catalogItemId) === request;

      try {
        const addedCatalogItemIds = await (saveCatalogItem
          ? saveCatalogItem(catalogItemId, controller.signal)
          : repository.addCatalogItemIds(
              isAuthenticated ? "authenticated" : "guest",
              [String(catalogItemId)],
              controller.signal,
            ));
        if (!isCurrentRequest()) return false;
        addedCatalogItemIdsRef.current.ids.add(catalogItemId);
        setState((current) =>
          current.authScope === authScope
            ? {
                ...current,
                addedCatalogItemIds: [
                  ...current.addedCatalogItemIds,
                  catalogItemId,
                ],
              }
            : current,
        );
        onSuccess?.(catalogItemId, addedCatalogItemIds.length);
        return true;
      } catch (error) {
        if (!isCurrentRequest()) return false;
        const requiresAuthentication =
          error instanceof PreparationAuthenticationRequiredError;
        if (requiresAuthentication) onAuthenticationRequired();
        setState((current) =>
          current.authScope === authScope
            ? {
                ...current,
                additionErrors: {
                  ...current.additionErrors,
                  [catalogItemId]: requiresAuthentication
                    ? authenticationErrorMessage
                    : errorMessage,
                },
              }
            : current,
        );
        return false;
      } finally {
        if (controllersRef.current.get(catalogItemId) === request) {
          controllersRef.current.delete(catalogItemId);
          setState((current) =>
            current.authScope === authScope
              ? {
                  ...current,
                  addingCatalogItemIds: current.addingCatalogItemIds.filter(
                    (id) => id !== catalogItemId,
                  ),
                }
              : current,
          );
        }
      }
    },
    [
      authScope,
      allowGuestAddition,
      isAuthenticated,
      onAuthenticationRequired,
      onSuccess,
      repository,
      saveCatalogItem,
      errorMessage,
    ],
  );

  return {
    add,
    addedCatalogItemIds: currentState.addedCatalogItemIds,
    addingCatalogItemIds: currentState.addingCatalogItemIds,
    additionErrors: currentState.additionErrors,
  };
}
