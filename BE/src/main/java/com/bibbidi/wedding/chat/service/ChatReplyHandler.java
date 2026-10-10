package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.dto.ChatResult;

public interface ChatReplyHandler {

    void conversation(String conversationId);

    void delta(String text);

    // 완료와 취소가 겹쳐도 취소된 답변은 기억하지 않도록 완료 처리 안에서 실행한다.
    void complete(ChatResult result, Runnable remember);
}
