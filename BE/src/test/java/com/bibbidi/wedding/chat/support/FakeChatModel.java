package com.bibbidi.wedding.chat.support;

import java.util.function.Function;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import reactor.core.publisher.Flux;

/**
 * Bedrock 모델 호출을 대신하는 가짜 모델. 생성할 때 받은 응답을 스트리밍한다.
 */
public class FakeChatModel implements ChatModel {

    private final ChatOptions options;
    private final Function<Prompt, Flux<ChatResponse>> responder;

    public FakeChatModel(Flux<ChatResponse> response) {
        this(prompt -> response);
    }

    public FakeChatModel(Function<Prompt, Flux<ChatResponse>> responder) {
        this(ToolCallingChatOptions.builder().build(), responder);
    }

    public FakeChatModel(ChatOptions options, Flux<ChatResponse> response) {
        this(options, prompt -> response);
    }

    public FakeChatModel(ChatOptions options, Function<Prompt, Flux<ChatResponse>> responder) {
        this.options = options;
        this.responder = responder;
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        return responder.apply(prompt);
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        throw new UnsupportedOperationException("스트리밍 호출만 지원하는 가짜 모델입니다.");
    }

    @Override
    public ChatOptions getDefaultOptions() {
        return options;
    }

    @Override
    public ChatOptions getOptions() {
        return options;
    }
}
