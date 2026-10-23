package com.bibbidi.wedding.chat.adapter.ai.parser;

import java.util.function.Consumer;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class JacksonChatAnswerParser {

    private final ObjectMapper mapper;

    public JacksonChatAnswerParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public ReactiveChatAnswerStream newSession(Consumer<String> answerChunk) {
        return new ReactiveChatAnswerStream(mapper, answerChunk);
    }
}
