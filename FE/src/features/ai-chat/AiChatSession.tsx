import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useMyChecklistQueryRepository } from "../checklist";
import { useAiChatChecklistRefresh } from "./hooks/useAiChatChecklistRefresh";
import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { useAiChatRecommendations } from "./hooks/useAiChatRecommendations";

interface AiChatSessionProps {
  children: ReactNode;
  isAuthenticated: boolean;
  feedbackAudienceKey: string;
  onAuthenticationRequired: () => void;
  onKeyboardVisibilityChange?: (visible: boolean) => void;
}

function useSessionState({
  isAuthenticated,
  feedbackAudienceKey,
  onAuthenticationRequired,
  onKeyboardVisibilityChange,
}: AiChatSessionProps) {
  const checklistRefresh = useAiChatChecklistRefresh(onAuthenticationRequired);
  const conversation = useAiChatConversation(
    onAuthenticationRequired,
    undefined,
    checklistRefresh.refresh,
  );
  const query = useMyChecklistQueryRepository();
  const [addedTask, setAddedTask] = useState<{
    title: string;
    taskId?: string;
  } | null>(null);
  const additionRequestRef = useRef<AbortController | null>(null);
  useEffect(() => () => additionRequestRef.current?.abort(), []);
  const recommendations = useAiChatRecommendations(
    conversation.messages,
    isAuthenticated,
    onAuthenticationRequired,
    (catalogItemIds) => {
      additionRequestRef.current?.abort();
      const controller = new AbortController();
      additionRequestRef.current = controller;
      setAddedTask({
        title: `${catalogItemIds.length}개의 할 일을 체크리스트에 추가했어요.`,
      });
      if (catalogItemIds.length !== 1) return;
      void query
        .getChecklist(controller.signal)
        .then((checklist) => {
          if (controller.signal.aborted) return;
          const item = checklist.items.find(
            (item) => item.sourceCatalogItemId === catalogItemIds[0],
          );
          if (item)
            setAddedTask({
              title: `${item.title} 추가 완료`,
              taskId: `checklist-item-${item.id}`,
            });
        })
        .catch(() => {});
    },
  );
  return {
    ...conversation,
    isAuthenticated,
    feedbackAudienceKey,
    onKeyboardVisibilityChange,
    checklistRefresh,
    recommendations,
    addedTask,
  };
}

const AiChatSessionContext = createContext<ReturnType<
  typeof useSessionState
> | null>(null);

/** Keep this session alive between service tabs; account changes remount it. */
export function AiChatSessionProvider(props: AiChatSessionProps) {
  const session = useSessionState(props);
  return (
    <AiChatSessionContext.Provider value={session}>
      {props.children}
    </AiChatSessionContext.Provider>
  );
}

export function useAiChatSession() {
  const session = useContext(AiChatSessionContext);
  if (!session) throw new Error("AI 챗 세션을 찾을 수 없습니다.");
  return session;
}
