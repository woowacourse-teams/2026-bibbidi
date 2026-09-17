import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { PreparationAuthenticationRequiredError } from "../preparation";
import type { ChecklistRepository } from "../preparation";
import type { RecommendedTaskAdditionState } from "./model/recommendedTaskAddition";

interface UseRecommendedTaskAdditionOptions {
  authScope: string;
  isAuthenticated: boolean;
  onAuthenticationRequired: () => void;
  onSuccess: (catalogItemId: number, itemCount: number) => void;
  repository: ChecklistRepository;
}

export interface RecommendedTaskAdditionController extends RecommendedTaskAdditionState {
  add: (catalogItemId: number) => void;
}

const authenticationErrorMessage =
  "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.";
const additionErrorMessage = "할 일을 추가하지 못했어요. 다시 시도해 주세요.";

interface RecommendedTaskAdditionScopedState extends RecommendedTaskAdditionState {
  authScope: string;
}

function createEmptyState(
  authScope: string,
): RecommendedTaskAdditionScopedState {
  return {
    addedCatalogItemIds: [],
    addingCatalogItemIds: [],
    additionErrors: {},
    authScope,
  };
}

export function useRecommendedTaskAddition({
  authScope,
  isAuthenticated,
  onAuthenticationRequired,
  onSuccess,
  repository,
}: UseRecommendedTaskAdditionOptions): RecommendedTaskAdditionController {
  const currentAuthScopeRef = useRef(authScope);
  const controllersRef = useRef(
    new Map<number, { authScope: string; controller: AbortController }>(),
  );
  const addedCatalogItemIdsRef = useRef({
    authScope,
    ids: new Set<number>(),
  });
  const [state, setState] = useState<RecommendedTaskAdditionScopedState>(() =>
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
    (catalogItemId: number) => {
      if (
        !isAuthenticated ||
        controllersRef.current.get(catalogItemId)?.authScope === authScope
      ) {
        return;
      }

      if (addedCatalogItemIdsRef.current.authScope !== authScope) {
        addedCatalogItemIdsRef.current = {
          authScope,
          ids: new Set<number>(),
        };
      }

      if (addedCatalogItemIdsRef.current.ids.has(catalogItemId)) {
        return;
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

      void repository
        .addCatalogItemIds(
          "authenticated",
          [String(catalogItemId)],
          controller.signal,
        )
        .then((addedCatalogItemIds) => {
          if (
            controller.signal.aborted ||
            currentAuthScopeRef.current !== authScope ||
            controllersRef.current.get(catalogItemId) !== request
          ) {
            return;
          }

          addedCatalogItemIdsRef.current.ids.add(catalogItemId);
          setState((current) => {
            if (current.authScope !== authScope) {
              return current;
            }

            return {
              ...current,
              addedCatalogItemIds: [
                ...current.addedCatalogItemIds,
                catalogItemId,
              ],
            };
          });
          onSuccess(catalogItemId, addedCatalogItemIds.length);
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            currentAuthScopeRef.current !== authScope ||
            controllersRef.current.get(catalogItemId) !== request
          ) {
            return;
          }

          const requiresAuthentication =
            error instanceof PreparationAuthenticationRequiredError;

          if (requiresAuthentication) {
            onAuthenticationRequired();
          }

          setState((current) =>
            current.authScope === authScope
              ? {
                  ...current,
                  additionErrors: {
                    ...current.additionErrors,
                    [catalogItemId]: requiresAuthentication
                      ? authenticationErrorMessage
                      : additionErrorMessage,
                  },
                }
              : current,
          );
        })
        .finally(() => {
          if (controllersRef.current.get(catalogItemId) !== request) {
            return;
          }

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
        });
    },
    [
      authScope,
      isAuthenticated,
      onAuthenticationRequired,
      onSuccess,
      repository,
    ],
  );

  return {
    add,
    addedCatalogItemIds: currentState.addedCatalogItemIds,
    addingCatalogItemIds: currentState.addingCatalogItemIds,
    additionErrors: currentState.additionErrors,
  };
}
