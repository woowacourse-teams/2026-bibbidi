package com.bibbidi.wedding.chat.service.parser;

import com.bibbidi.wedding.chat.service.port.ChatAnswerParser;
import java.util.function.Consumer;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class JacksonChatAnswerParser implements ChatAnswerParser {

    private final ObjectMapper mapper;

    public JacksonChatAnswerParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public Session newSession(Consumer<String> answerChunk) {
        return new ReactiveChatAnswerStream(mapper, answerChunk);
    }
}
