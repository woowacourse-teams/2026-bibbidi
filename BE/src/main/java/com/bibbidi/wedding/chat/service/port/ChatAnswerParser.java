package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import java.util.function.Consumer;

public interface ChatAnswerParser {

    Session newSession(Consumer<String> answerChunk);

    interface Session {

        void accept(String chunk);

        ChatAnswer finish();
    }
}
