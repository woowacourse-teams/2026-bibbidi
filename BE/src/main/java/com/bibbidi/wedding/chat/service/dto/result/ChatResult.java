package com.bibbidi.wedding.chat.service.dto.result;

import com.bibbidi.wedding.chat.service.turn.CancelReason;
import java.util.List;

/** 한 턴에서 모델, 서비스, 구독자가 주고받는 사건. */
public sealed interface ChatResult {

    record Conversation(String conversationId) implements ChatResult {
    }

    record Selected(String model) implements ChatResult {
    }

    record Delta(String text) implements ChatResult {
    }

    record Answer(String answer, List<Long> recommendedItemIds) implements ChatResult {
    }

    record Completed() implements ChatResult {
    }

    record Failed(Throwable cause) implements ChatResult {
    }

    record Cancelled(CancelReason reason) implements ChatResult {
    }
}
