package com.bibbidi.wedding.chat.support;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import reactor.core.publisher.Flux;

/**
 * Bedrock 모델 호출을 대신하는 가짜 모델. 미리 정해 둔 응답을 스트리밍하고, 전달받은 프롬프트를 기록한다.
 */
public class FakeChatModel implements ChatModel {

    private final ChatOptions options;
    private final List<Prompt> prompts = new CopyOnWriteArrayList<>();
    private final AtomicInteger callCount = new AtomicInteger();
    private volatile Function<Prompt, Flux<ChatResponse>> responder = prompt -> Flux.empty();

    public FakeChatModel() {
        this(ToolCallingChatOptions.builder().build());
    }

    public FakeChatModel(ChatOptions options) {
        this.options = options;
    }

    public FakeChatModel respondWith(Flux<ChatResponse> response) {
        this.responder = prompt -> response;
        return this;
    }

    public FakeChatModel respondWith(Function<Prompt, Flux<ChatResponse>> responder) {
        this.responder = responder;
        return this;
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        prompts.add(prompt);
        return responder.apply(prompt);
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        callCount.incrementAndGet();
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

    public void reset() {
        prompts.clear();
        callCount.set(0);
        responder = prompt -> Flux.empty();
    }

    public List<Prompt> prompts() {
        return List.copyOf(prompts);
    }

    public Prompt lastPrompt() {
        return prompts.getLast();
    }

    public int callCount() {
        return callCount.get();
    }
}
