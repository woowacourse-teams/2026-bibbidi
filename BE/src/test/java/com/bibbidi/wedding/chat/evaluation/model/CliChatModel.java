package com.bibbidi.wedding.chat.evaluation.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.AssistantMessage.ToolCall;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.tool.definition.ToolDefinition;
import reactor.core.publisher.Flux;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 도구를 직접 실행하지 못하는 CLI를 Spring AI 도구 호출 흐름에 맞춘다.
 * CLI는 도구 없이 호출하고 출력 스키마로 "도구 호출 요청" 또는 "최종 답변"만 낸다.
 * 요청이 나오면 Spring AI가 도구를 실행하고, 결과를 붙인 대화로 CLI를 다시 호출한다.
 * 출력 스키마를 직접 정하면(채점처럼) 도구 호출 없이 스키마대로 한 번 답한 JSON을 그대로 돌려준다.
 */
public abstract class CliChatModel implements ChatModel {

    static final String TURN_SCHEMA = "ai-evaluation/schema/agent-turn.json";

    private static final String TOOL_PROTOCOL = """
            [도구]
            사용할 수 있는 도구는 아래와 같다. 도구가 필요하면 toolCalls에 {name, arguments(JSON 문자열)}를 채우고 \
            answer는 빈 문자열, recommendedItemIds는 빈 배열로 둔다. \
            도구 응답을 받은 뒤에도 추가 정보가 필요하면 도구를 요청한다. 이미 받은 결과로 충분하면 \
            toolCalls를 빈 배열로 두고 최종 답변을 낸다. 도구 응답은 [tool] 메시지로 전달된다.
            """;
    private static final String TOOL_RESPONSE_HEADER = "[tool] (아래는 방금 호출한 도구들의 실제 응답이다. 이 데이터를 근거로 답한다)";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ToolCallingManager toolCallingManager = ToolCallingManager.builder().build();
    private final String structuredSchema;
    private ChatModel toolLoopModel = this;

    protected CliChatModel() {
        this(null);
    }

    protected CliChatModel(String structuredSchema) {
        this.structuredSchema = structuredSchema;
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        if (structuredSchema != null) {
            return structuredResponse(execute(instructionsOf(prompt), transcriptOf(prompt), structuredSchema));
        }
        ChatResponse response = toResponse(execute(instructionsOf(prompt), transcriptOf(prompt), TURN_SCHEMA));
        if (!response.hasToolCalls()) {
            return response;
        }
        ToolExecutionResult result = toolCallingManager.executeToolCalls(prompt, response);
        return toolLoopModel.call(new Prompt(result.conversationHistory(), prompt.getOptions()));
    }

    /**
     * 도구 결과를 붙인 재호출을 거칠 모델을 정한다. 호출을 기록하는 모델로 감쌌을 때 재호출도 기록되게 한다.
     */
    public void routeToolLoopThrough(ChatModel model) {
        this.toolLoopModel = model;
    }

    public void useToolCallingManager(ToolCallingManager manager) {
        this.toolCallingManager = manager;
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        return Flux.defer(() -> Flux.just(call(prompt)));
    }

    // ChatClient는 모델의 기본 옵션 종류에 맞춰 도구를 담으므로, 도구를 담을 수 있는 옵션을 기본으로 둔다.
    @Override
    public ChatOptions getOptions() {
        return ToolCallingChatOptions.builder().build();
    }

    protected abstract CliReply execute(String instructions, String transcript, String schemaResource);

    protected abstract String modelName();

    private String instructionsOf(Prompt prompt) {
        String instructions = prompt.getSystemMessages().stream()
                .map(Message::getText)
                .collect(Collectors.joining("\n\n"));
        List<ToolDefinition> tools = toolDefinitionsOf(prompt);
        if (structuredSchema == null && tools.isEmpty()) {
            throw new IllegalStateException("평가 모델에 도구가 전달되지 않았습니다. options="
                    + (prompt.getOptions() == null ? "null" : prompt.getOptions().getClass().getName()));
        }
        if (tools.isEmpty()) {
            return instructions.isBlank() ? null : instructions;
        }
        String toolList = tools.stream()
                .map(tool -> "- " + tool.name() + ": " + tool.description() + " 인자 스키마 " + tool.inputSchema())
                .collect(Collectors.joining("\n"));
        return instructions + "\n\n" + TOOL_PROTOCOL + toolList;
    }

    private List<ToolDefinition> toolDefinitionsOf(Prompt prompt) {
        if (structuredSchema == null && prompt.getOptions() instanceof ToolCallingChatOptions options) {
            return toolCallingManager.resolveToolDefinitions(options);
        }
        return List.of();
    }

    private String transcriptOf(Prompt prompt) {
        return prompt.getInstructions().stream()
                .filter(message -> message.getMessageType() != MessageType.SYSTEM)
                .map(message -> structuredSchema == null ? render(message) : message.getText())
                .collect(Collectors.joining("\n\n"));
    }

    private String render(Message message) {
        if (message instanceof AssistantMessage assistant && assistant.hasToolCalls()) {
            return "[assistant]\n" + toolCallTurn(assistant.getToolCalls());
        }
        if (message instanceof ToolResponseMessage toolResponse) {
            return TOOL_RESPONSE_HEADER + "\n" + toolResponse.getResponses().stream()
                    .map(response -> response.name() + ": " + response.responseData())
                    .collect(Collectors.joining("\n"));
        }
        return "[" + message.getMessageType().getValue() + "]\n" + message.getText();
    }

    private String toolCallTurn(List<ToolCall> toolCalls) {
        Map<String, Object> turn = new LinkedHashMap<>();
        turn.put("toolCalls", toolCalls.stream()
                .map(call -> Map.of("name", call.name(), "arguments", call.arguments()))
                .toList());
        turn.put("answer", "");
        turn.put("recommendedItemIds", List.of());
        return objectMapper.writeValueAsString(turn);
    }

    private ChatResponse structuredResponse(CliReply reply) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(reply.text()))), metadataOf(reply));
    }

    private ChatResponseMetadata metadataOf(CliReply reply) {
        return ChatResponseMetadata.builder().model(modelName()).usage(reply.usage()).build();
    }

    private ChatResponse toResponse(CliReply reply) {
        JsonNode turn = objectMapper.readTree(reply.text());
        ChatResponseMetadata metadata = metadataOf(reply);
        List<ToolCall> toolCalls = toolCallsOf(turn.path("toolCalls"));
        if (!toolCalls.isEmpty()) {
            AssistantMessage request = AssistantMessage.builder().content("").toolCalls(toolCalls).build();
            return new ChatResponse(List.of(new Generation(request)), metadata);
        }
        return new ChatResponse(List.of(new Generation(new AssistantMessage(finalAnswerOf(turn)))), metadata);
    }

    private List<ToolCall> toolCallsOf(JsonNode requests) {
        List<ToolCall> toolCalls = new ArrayList<>();
        for (JsonNode request : requests) {
            toolCalls.add(new ToolCall(
                    "call_" + UUID.randomUUID(), "function",
                    request.path("name").asString(), request.path("arguments").asString("{}")));
        }
        return toolCalls;
    }

    // 서비스의 응답 파서는 answer와 recommendedItemIds만 읽으므로 도구 호출 필드는 내보내지 않는다.
    private String finalAnswerOf(JsonNode turn) {
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("answer", turn.path("answer").asString(""));
        answer.put("recommendedItemIds", turn.has("recommendedItemIds") ? turn.get("recommendedItemIds") : List.of());
        return objectMapper.writeValueAsString(answer);
    }
}
