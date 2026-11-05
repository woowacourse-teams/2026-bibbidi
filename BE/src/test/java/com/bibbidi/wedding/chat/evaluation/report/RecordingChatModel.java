package com.bibbidi.wedding.chat.evaluation.report;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;

public class RecordingChatModel implements ChatModel {

    private final ChatModel delegate;
    private final List<ModelCall> calls = new CopyOnWriteArrayList<>();

    public RecordingChatModel(ChatModel delegate) {
        this.delegate = delegate;
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        ChatResponse response = delegate.call(prompt);
        calls.add(new ModelCall(prompt, response));
        return response;
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        return Flux.defer(() -> {
            StreamRecording recording = new StreamRecording(prompt);
            return Flux.defer(() -> delegate.stream(prompt))
                    .doOnNext(recording::accept)
                    .doOnComplete(recording::finish)
                    .doOnError(ignored -> recording.finish())
                    .doOnCancel(recording::finish);
        });
    }

    @Override
    public ChatOptions getDefaultOptions() {
        return delegate.getDefaultOptions();
    }

    @Override
    public ChatOptions getOptions() {
        return delegate.getOptions();
    }

    public List<ModelCall> calls() {
        return List.copyOf(calls);
    }

    public void reset() {
        calls.clear();
    }

    public record ModelCall(Prompt prompt, ChatResponse response) {
    }

    private final class StreamRecording {

        private final Prompt prompt;
        private final StringBuffer answer = new StringBuffer();
        private final AtomicBoolean finished = new AtomicBoolean();
        private volatile Usage usage;

        private StreamRecording(Prompt prompt) {
            this.prompt = prompt;
        }

        private void accept(ChatResponse response) {
            if (response.getResult() != null && response.getResult().getOutput().getText() != null) {
                answer.append(response.getResult().getOutput().getText());
            }
            Usage current = response.getMetadata().getUsage();
            // 스트리밍 누적 사용량을 조각마다 더하지 않고 마지막으로 제공된 값을 보존한다.
            if (current != null && current.getTotalTokens() != null && current.getTotalTokens() > 0) {
                usage = current;
            }
        }

        private void finish() {
            if (finished.compareAndSet(false, true)) {
                ChatResponse response = new ChatResponse(
                        List.of(new Generation(new AssistantMessage(answer.toString()))),
                        ChatResponseMetadata.builder().usage(usage).build());
                calls.add(new ModelCall(prompt, response));
            }
        }
    }
}
