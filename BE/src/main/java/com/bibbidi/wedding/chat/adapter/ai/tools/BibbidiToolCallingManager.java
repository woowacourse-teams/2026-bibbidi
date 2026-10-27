package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingProperties;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.tool.definition.ToolDefinition;

@Slf4j
public class BibbidiToolCallingManager implements ToolCallingManager {

    private static final String QUESTION_ID = "next_tool";
    private static final String FINISH = "finish";
    private static final Set<String> AUTO_READ_TOOLS = Set.of("getCatalog", "getMyChecklist");
    private static final int MAX_EXTRA_CALLS = 2;
    private static final int MAX_RESULT_CHARACTERS = 1200;

    private final ToolCallingManager delegate;
    private final ModelRoutingProperties properties;
    private final JevClient jev;

    public BibbidiToolCallingManager(ToolCallingManager delegate, ModelRoutingProperties properties, JevClient jev) {
        this.delegate = delegate;
        this.properties = properties;
        this.jev = jev;
    }

    @Override
    public List<ToolDefinition> resolveToolDefinitions(ToolCallingChatOptions options) {
        return delegate.resolveToolDefinitions(options);
    }

    @Override
    public ToolExecutionResult executeToolCalls(Prompt prompt, ChatResponse response) {
        ToolExecutionResult result = delegate.executeToolCalls(prompt, response);
        if (result.returnDirect()) {
            return result;
        }

        for (int index = 0; index < MAX_EXTRA_CALLS; index++) {
            List<ToolDefinition> remaining = remainingReadTools(prompt, result.conversationHistory());
            if (remaining.isEmpty()) {
                return result;
            }
            String next = chooseNextTool(result.conversationHistory(), remaining);
            if (FINISH.equals(next)) {
                return result;
            }
            ChatResponse nextCall = new ChatResponse(List.of(new Generation(
                    AssistantMessage.builder().content("")
                            .toolCalls(List.of(new AssistantMessage.ToolCall(
                                    UUID.randomUUID().toString(), "function", next, "{}")))
                            .build())));
            result = delegate.executeToolCalls(new Prompt(result.conversationHistory(), prompt.getOptions()), nextCall);
            if (result.returnDirect()) {
                return result;
            }
        }
        return result;
    }

    private List<ToolDefinition> remainingReadTools(Prompt prompt, List<Message> history) {
        if (!(prompt.getOptions() instanceof ToolCallingChatOptions options)) {
            return List.of();
        }
        Set<String> used = currentTurn(history).stream()
                .filter(AssistantMessage.class::isInstance)
                .map(AssistantMessage.class::cast)
                .flatMap(message -> message.getToolCalls().stream())
                .map(AssistantMessage.ToolCall::name)
                .collect(Collectors.toSet());
        return delegate.resolveToolDefinitions(options).stream()
                .filter(tool -> AUTO_READ_TOOLS.contains(tool.name()) && !used.contains(tool.name()))
                .toList();
    }

    private String chooseNextTool(List<Message> history, List<ToolDefinition> remaining) {
        try {
            List<Message> currentTurn = currentTurn(history);
            Map<String, String> criteria = new LinkedHashMap<>();
            criteria.put(FINISH, "이미 실행한 도구 결과만으로 답변에 필요한 정보가 충분하다");
            remaining.forEach(tool -> criteria.put(tool.name(), tool.description()));
            String userMessage = history.stream()
                    .filter(message -> message.getMessageType() == MessageType.USER)
                    .reduce((first, second) -> second)
                    .map(Message::getText)
                    .orElse("");
            String executedTools = currentTurn.stream()
                    .filter(ToolResponseMessage.class::isInstance)
                    .map(ToolResponseMessage.class::cast)
                    .flatMap(message -> message.getResponses().stream())
                    .map(ToolResponseMessage.ToolResponse::name)
                    .distinct()
                    .collect(Collectors.joining(", "));
            String latestResult = currentTurn.stream()
                    .filter(ToolResponseMessage.class::isInstance)
                    .map(ToolResponseMessage.class::cast)
                    .reduce((first, second) -> second)
                    .map(message -> message.getResponses().stream()
                            .map(response -> response.name() + ": " + response.responseData())
                            .collect(Collectors.joining("\n")))
                    .orElse("");
            if (latestResult.length() > MAX_RESULT_CHARACTERS) {
                latestResult = latestResult.substring(0, MAX_RESULT_CHARACTERS);
            }
            JevClient.Choice answer = jev.choose(new JevClient.Question(
                    QUESTION_ID,
                    "사용자 요청: " + userMessage + "\n이미 조회한 도구: " + executedTools
                            + "\n마지막 조회 결과: " + latestResult,
                    "이미 조회한 결과만으로 답할 수 있으면 finish를, 추가 조회가 필요하면 해당 도구를 고르세요.",
                    criteria));
            if (!criteria.containsKey(answer.value()) || answer.isUnsure(properties.minConfidence())) {
                log.debug("Jev 도구 선택의 신뢰도가 낮거나 응답이 유효하지 않습니다.");
                return FINISH;
            }
            log.debug("Jev 도구 선택. choice={}", answer.value());
            return answer.value();
        } catch (RuntimeException failure) {
            log.debug("Jev 도구 선택 실패. type={}", failure.getClass().getSimpleName());
            return FINISH;
        }
    }

    private List<Message> currentTurn(List<Message> history) {
        for (int index = history.size() - 1; index >= 0; index--) {
            if (history.get(index).getMessageType() == MessageType.USER) {
                return history.subList(index, history.size());
            }
        }
        return history;
    }
}
