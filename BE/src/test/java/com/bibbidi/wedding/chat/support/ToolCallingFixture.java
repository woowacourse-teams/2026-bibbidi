package com.bibbidi.wedding.chat.support;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRequest;
import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.DefaultToolCallingManager;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionResult;
import reactor.core.publisher.Flux;

public class ToolCallingFixture {

    private static final String CONVERSATION = "7:7bf4d204-8331-439b-bd8f-271abc0eea99";

    private final List<Prompt> receivedPrompts = new CopyOnWriteArrayList<>();
    private final ToolCallingManager toolCallingManager;
    private final SpringAiChatClient chatClient;

    public ToolCallingFixture(Object... tools) {
        this(DefaultToolCallingManager.builder().build(), tools);
    }

    public ToolCallingFixture(ToolCallingManager toolCallingManager, Object... tools) {
        this.toolCallingManager = toolCallingManager;
        FakeChatModel model = new FakeChatModel(prompt -> {
            receivedPrompts.add(prompt);
            return Flux.just(new ChatResponse(List.of(new Generation(new AssistantMessage("답변")))));
        });
        this.chatClient = SpringAiChatClientFixture.create(ChatClient.builder(model).defaultTools(tools).build());
    }

    public List<String> registeredToolNames(Long userId) {
        Prompt prompt = send(userId);
        return ((ToolCallingChatOptions) prompt.getOptions()).getToolCallbacks().stream()
                .map(callback -> callback.getToolDefinition().name())
                .toList();
    }

    public String callTool(Long userId, String toolName, String arguments) {
        Prompt prompt = send(userId);
        AssistantMessage toolCallMessage = AssistantMessage.builder()
                .content("")
                .toolCalls(List.of(new AssistantMessage.ToolCall("call-1", "function", toolName, arguments)))
                .build();
        ChatResponse modelResponse = new ChatResponse(List.of(new Generation(toolCallMessage)));

        ToolExecutionResult result = toolCallingManager.executeToolCalls(prompt, modelResponse);

        Message last = result.conversationHistory().getLast();
        return ((ToolResponseMessage) last).getResponses().getFirst().responseData();
    }

    public boolean writeSucceeded() {
        Prompt prompt = receivedPrompts.getLast();
        AtomicBoolean succeeded = (AtomicBoolean) ((ToolCallingChatOptions) prompt.getOptions())
                .getToolContext().get("writeSucceeded");
        return succeeded.get();
    }

    private Prompt send(Long userId) {
        chatClient.streamReply(new ChatModelRequest(userId, CONVERSATION,
                new UserMessage("질문")), ChatModelTier.LOW).blockLast();
        return receivedPrompts.getLast();
    }
}
