package com.bibbidi.wedding.chat.adapter.ai;

import java.time.Duration;
import java.util.List;
import java.util.function.DoubleSupplier;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import reactor.core.publisher.Flux;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

/**
 * 부하 테스트에서 실제 모델 호출을 대신한다. 설정한 지연과 간격으로 토큰을 흘리고,
 * 설정한 비율만큼은 실제 모델과 같은 한도 초과 예외로 실패한다.
 */
public class LoadTestChatModel implements ChatModel {

    private final LoadTestChatModelProperties properties;
    private final DoubleSupplier randomRatio;
    private final ChatOptions options = ToolCallingChatOptions.builder().build();

    public LoadTestChatModel(LoadTestChatModelProperties properties, DoubleSupplier randomRatio) {
        this.properties = properties;
        this.randomRatio = randomRatio;
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        return Flux.defer(() -> {
            if (randomRatio.getAsDouble() < properties.throttleRatio()) {
                return Flux.error(ThrottlingException.builder()
                        .message("모의 모델의 한도 초과 응답입니다.")
                        .build());
            }
            return Flux.interval(
                            Duration.ofMillis(properties.ttftMs()),
                            Duration.ofMillis(properties.chunkIntervalMs()))
                    .take(properties.chunks())
                    .map(index -> new ChatResponse(
                            List.of(new Generation(new AssistantMessage(chunkText(index))))));
        });
    }

    // 서비스는 모델 출력을 {"answer":"...","recommendedItemIds":[...]} JSON으로 읽는다.
    // 첫 조각에 여는 부분을, 마지막 조각에 닫는 부분을 붙여 첫 토큰 지연이 답변 첫 글자 시점이 되게 한다.
    private String chunkText(long index) {
        StringBuilder text = new StringBuilder();
        if (index == 0) {
            text.append("{\"answer\":\"");
        }
        text.append("토큰").append(index).append(' ');
        if (index == properties.chunks() - 1) {
            text.append("\",\"recommendedItemIds\":[]}");
        }
        return text.toString();
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        throw new UnsupportedOperationException("스트리밍 호출만 지원하는 모의 모델입니다.");
    }

    @Override
    public ChatOptions getOptions() {
        return options;
    }
}
