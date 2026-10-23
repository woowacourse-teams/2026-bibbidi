package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import com.bibbidi.wedding.chat.service.dto.result.AiResponseStream;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Map;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import tools.jackson.databind.ObjectMapper;

@Component
public class SpringAiConversationAdapter implements AiConversationPort {

    private final ChatClient chatClient;
    private final BibbidiInMemoryChatMemory bibbidiInMemoryChatMemory;
    private final ObjectMapper mapper;
    private final AiChatStreamRecorder recorder;

    public SpringAiConversationAdapter(
            ChatClient chatClient,
            BibbidiInMemoryChatMemory bibbidiInMemoryChatMemory,
            ObjectMapper mapper,
            AiChatStreamRecorder recorder
    ) {
        this.chatClient = chatClient;
        this.bibbidiInMemoryChatMemory = bibbidiInMemoryChatMemory;
        this.mapper = mapper;
        this.recorder = recorder;
    }

    @Override
    public AiResponseStream stream(String conversationKey, String userPrompt, BibbidiCustomChatPromptContext context) {
        bibbidiInMemoryChatMemory.remember(conversationKey, context);

        List<Message> memories = bibbidiInMemoryChatMemory.get(conversationKey);
        BibbidiCustomChatPromptContext currentContext = bibbidiInMemoryChatMemory.bibbidiCustomContext(conversationKey);

        Message checklist = new UserMessage(
                mapper.writeValueAsString(
                        Map.of(
                                "checklist", currentContext.checklist(),
                                "recommendableItemIds", currentContext.recommendableItemIds()
                        )
                )
        );
        Message catalog = new UserMessage(
                mapper.writeValueAsString(
                        Map.of("catalog", currentContext.catalog())
                )
        );

        UserMessage userMessage = new UserMessage(userPrompt);

        Flux<String> answerFlux = recorder.record(
                        userPrompt,
                        chatClient.prompt()
                                .messages(memories)
                                .messages(checklist, catalog)
                                .messages(userMessage)
                                .stream()
                                .chatResponse()
                )
                .onErrorMap(SpringAiConversationAdapter::isThrottled, exception -> new BusinessException(
                        ClientError.AI_CAPACITY_EXCEEDED, "Bedrock 호출 한도 초과", exception))
                .map(AiChatStreamRecorder::textOf)
                .filter(text -> !text.isEmpty());

        return new AiResponseStream(
                answerFlux,
                currentContext.recommendableItemIds()
        );
    }

    @Override
    public void remember(String conversationKey, String userPrompt, String answer) {
        bibbidiInMemoryChatMemory.add(
                conversationKey,
                List.of(new UserMessage(userPrompt), new AssistantMessage(answer))
        );
    }

    private static boolean isThrottled(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ThrottlingException) {
                return true;
            }
        }
        return false;
    }

}
