package com.bibbidi.wedding.chat.support;

import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
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

/**
 * 도구를 등록한 ChatClient가 모델에 보낸 요청으로, 모델이 도구를 고른 상황을 재현한다.
 * 실제 모델은 도구 실행을 ToolCallingManager에 맡기므로 같은 매니저로 도구를 실행한다.
 */
public class ToolCallingFixture {

    private static final String CONVERSATION = "7:7bf4d204-8331-439b-bd8f-271abc0eea99";

    private final List<Prompt> receivedPrompts = new CopyOnWriteArrayList<>();
    private final ToolCallingManager toolCallingManager = DefaultToolCallingManager.builder().build();
    private final SpringAiChatClient chatClient;

    public ToolCallingFixture(Object... tools) {
        FakeChatModel model = new FakeChatModel(prompt -> {
            receivedPrompts.add(prompt);
            return Flux.just(new ChatResponse(List.of(new Generation(new AssistantMessage("답변")))));
        });
        this.chatClient = new SpringAiChatClient(ChatClient.builder(model).defaultTools(tools).build());
    }

    /**
     * 사용자의 요청을 보내고, 모델이 받은 요청에 등록된 도구 이름을 돌려준다.
     */
    public List<String> registeredToolNames(Long userId) {
        Prompt prompt = send(userId);
        return ((ToolCallingChatOptions) prompt.getOptions()).getToolCallbacks().stream()
                .map(callback -> callback.getToolDefinition().name())
                .toList();
    }

    /**
     * 모델이 도구를 호출했다고 가정하고 실행해, 모델에게 돌려줄 도구 응답(JSON)을 돌려준다.
     */
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

    private Prompt send(Long userId) {
        chatClient.streamReply(userId, CONVERSATION, new UserMessage("질문")).blockLast();
        return receivedPrompts.getLast();
    }
}
