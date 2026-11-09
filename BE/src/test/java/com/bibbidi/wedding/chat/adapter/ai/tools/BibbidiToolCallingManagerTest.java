package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingProperties;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.annotation.Tool;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class BibbidiToolCallingManagerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private HttpServer server;
    private final ConcurrentLinkedQueue<String> choices = new ConcurrentLinkedQueue<>();
    private final List<JsonNode> requests = new CopyOnWriteArrayList<>();
    private volatile int status = 200;
    private volatile double confidence = 0.95;
    private ReadTools tools;
    private BibbidiToolCallingManager manager;

    @BeforeEach
    void setUp() throws IOException {
        tools = new ReadTools();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/systemone", exchange -> {
            requests.add(MAPPER.readTree(exchange.getRequestBody().readAllBytes()));
            String choice = choices.poll();
            byte[] body = ("{\"answers\":{\"next_tool\":{\"choice\":\"" + (choice == null ? "finish" : choice)
                    + "\",\"confidence\":" + confidence + "}}}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length);
            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        server.start();
        ModelRoutingProperties properties = new ModelRoutingProperties(
                "test-key", "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/systemone",
                "jev-latest", Duration.ofSeconds(2), 0.7);
        manager = new BibbidiToolCallingManager(
                ToolCallingManager.builder().build(), properties, new JevClient(properties, MAPPER));
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void letsJevSelectAnotherReadToolBeforeReturningToModel() {
        choices.add("getMyChecklist");

        ToolExecutionResult result = execute(List.of(new UserMessage("질문")), "getCatalog");

        assertThat(tools.catalogCalls).hasValue(1);
        assertThat(tools.checklistCalls).hasValue(1);
        assertThat(tools.weddingDateCalls).hasValue(0);
        assertThat(result.returnDirect()).isFalse();
        assertThat(requests).hasSize(2);
    }

    @Test
    void asksJevWithTheRequestTheExecutedToolsAndTheRemainingReadTools() {
        choices.add("getMyChecklist");

        execute(List.of(new UserMessage("질문")), "getCatalog");

        JsonNode first = requests.get(0);
        assertThat(first.path("state").asText())
                .isEqualTo("사용자 요청: 질문\n이미 조회한 도구: getCatalog\n마지막 조회 결과: getCatalog: \"catalog\"");
        assertThat(first.path("model").asText()).isEqualTo("jev-latest");
        JsonNode question = first.path("questions").path("next_tool");
        assertThat(question.path("instructions").asText()).isNotBlank();
        JsonNode criteria = question.path("criteria");
        assertThat(criteria.propertyNames()).containsExactlyInAnyOrder("finish", "getMyChecklist", "getMyWeddingDate");
        assertThat(criteria.path("finish").asText()).isNotBlank();
        assertThat(criteria.path("getMyChecklist").asText()).isEqualTo("사용자 체크리스트를 조회한다");
        assertThat(criteria.path("getMyWeddingDate").asText()).isEqualTo("사용자 결혼 날짜를 조회한다");

        JsonNode second = requests.get(1);
        assertThat(second.path("state").asText())
                .isEqualTo("사용자 요청: 질문\n이미 조회한 도구: getCatalog, getMyChecklist\n마지막 조회 결과: getMyChecklist: \"checklist\"");
        assertThat(second.path("questions").path("next_tool").path("criteria").propertyNames())
                .containsExactly("finish", "getMyWeddingDate");
    }

    @Test
    void doesNotAskJevOnceEveryReadToolHasRun() {
        choices.add("getMyChecklist");
        choices.add("getMyWeddingDate");

        execute(List.of(new UserMessage("질문")), "getCatalog");

        assertThat(tools.catalogCalls).hasValue(1);
        assertThat(tools.checklistCalls).hasValue(1);
        assertThat(tools.weddingDateCalls).hasValue(1);
        assertThat(requests).hasSize(2);
    }

    @Test
    void addsAtMostTwoReadToolsToAnUnrelatedFirstCall() {
        choices.add("getCatalog");
        choices.add("getMyChecklist");
        choices.add("getMyWeddingDate");

        execute(List.of(new UserMessage("질문")), "lookupOther");

        assertThat(tools.otherCalls).hasValue(1);
        assertThat(tools.catalogCalls).hasValue(1);
        assertThat(tools.checklistCalls).hasValue(1);
        assertThat(tools.weddingDateCalls).hasValue(0);
        assertThat(requests).hasSize(2);
    }

    @Test
    void stopsWhenJevChoosesFinish() {
        choices.add("finish");

        execute(List.of(new UserMessage("질문")), "getCatalog");

        assertThat(tools.checklistCalls).hasValue(0);
        assertThat(tools.weddingDateCalls).hasValue(0);
        assertThat(requests).hasSize(1);
    }

    @Test
    void stopsWhenJevIsNotConfidentEnough() {
        confidence = 0.5;
        choices.add("getMyChecklist");

        execute(List.of(new UserMessage("질문")), "getCatalog");

        assertThat(tools.checklistCalls).hasValue(0);
    }

    @Test
    void runsTheChosenToolWhenConfidenceEqualsTheMinimum() {
        confidence = 0.7;
        choices.add("getMyChecklist");

        execute(List.of(new UserMessage("질문")), "getCatalog");

        assertThat(tools.checklistCalls).hasValue(1);
    }

    @Test
    void stopsWhenJevChoosesAToolThatIsNotOffered() {
        choices.add("getCatalog");

        execute(List.of(new UserMessage("질문")), "getCatalog");

        assertThat(tools.catalogCalls).hasValue(1);
        assertThat(tools.checklistCalls).hasValue(0);
    }

    @Test
    void returnsTheToolResultWhenJevFails() {
        status = 500;
        choices.add("getMyChecklist");

        ToolExecutionResult result = execute(List.of(new UserMessage("질문")), "getCatalog");

        assertThat(tools.checklistCalls).hasValue(0);
        assertThat(result.conversationHistory()).last().isInstanceOf(ToolResponseMessage.class);
    }

    @Test
    void returnsDirectlyWithoutAskingJevWhenTheFirstToolReturnsDirectly() {
        ToolExecutionResult result = execute(List.of(new UserMessage("질문")), "directRead");

        assertThat(result.returnDirect()).isTrue();
        assertThat(requests).isEmpty();
    }

    @Test
    void returnsDirectlyWhenAnAddedToolReturnsDirectly() {
        choices.add("getMyChecklist");

        ToolExecutionResult result = execute(
                List.of(new UserMessage("질문")), "getCatalog", new DirectChecklistTools());

        assertThat(result.returnDirect()).isTrue();
        assertThat(requests).hasSize(1);
    }

    @Test
    void ignoresReadToolsUsedInEarlierTurns() {
        choices.add("getMyChecklist");
        List<Message> history = List.of(
                new UserMessage("이전 질문"),
                AssistantMessage.builder().content("").toolCalls(List.of(
                        new AssistantMessage.ToolCall("old-1", "function", "getMyChecklist", "{}"))).build(),
                ToolResponseMessage.builder().responses(List.of(
                        new ToolResponseMessage.ToolResponse("old-1", "getMyChecklist", "old"))).build(),
                new AssistantMessage("이전 답변"),
                new UserMessage("지금 질문"));

        execute(history, "getCatalog");

        assertThat(tools.checklistCalls).hasValue(1);
        assertThat(requests.getFirst().path("state").asText())
                .isEqualTo("사용자 요청: 지금 질문\n이미 조회한 도구: getCatalog\n마지막 조회 결과: getCatalog: \"catalog\"");
    }

    @Test
    void usesTheWholeHistoryWhenThereIsNoUserMessage() {
        choices.add("getMyChecklist");

        execute(List.of(new AssistantMessage("안내")), "getCatalog");

        assertThat(requests.getFirst().path("state").asText())
                .isEqualTo("사용자 요청: \n이미 조회한 도구: getCatalog\n마지막 조회 결과: getCatalog: \"catalog\"");
        assertThat(tools.checklistCalls).hasValue(1);
    }

    @Test
    void cutsTheLatestResultSentToJev() {
        tools.catalogResult = "x".repeat(3000);

        execute(List.of(new UserMessage("질문")), "getCatalog");

        String state = requests.getFirst().path("state").asText();
        String latestResult = state.substring(state.indexOf("마지막 조회 결과: ") + "마지막 조회 결과: ".length());
        assertThat(latestResult).hasSize(1200).startsWith("getCatalog: \"xxx");
    }

    @Test
    void exposesTheDelegateToolDefinitions() {
        assertThat(manager.resolveToolDefinitions(options(tools)))
                .extracting(definition -> definition.name())
                .contains("getCatalog", "getMyChecklist", "getMyWeddingDate", "lookupOther", "directRead");
    }

    private ToolExecutionResult execute(List<Message> history, String firstTool) {
        return execute(history, firstTool, tools);
    }

    private ToolExecutionResult execute(List<Message> history, String firstTool, Object... toolObjects) {
        Prompt prompt = new Prompt(new ArrayList<>(history), options(toolObjects));
        ChatResponse response = new ChatResponse(List.of(new Generation(AssistantMessage.builder()
                .content("").toolCalls(List.of(
                        new AssistantMessage.ToolCall("call-1", "function", firstTool, "{}"))).build())));
        return manager.executeToolCalls(prompt, response);
    }

    private ToolCallingChatOptions options(Object... toolObjects) {
        return ToolCallingChatOptions.builder().toolCallbacks(ToolCallbacks.from(toolObjects)).build();
    }

    static class ReadTools {

        private final AtomicInteger catalogCalls = new AtomicInteger();
        private final AtomicInteger checklistCalls = new AtomicInteger();
        private final AtomicInteger weddingDateCalls = new AtomicInteger();
        private final AtomicInteger otherCalls = new AtomicInteger();
        private volatile String catalogResult = "catalog";

        @Tool(name = "getCatalog", description = "추천할 카탈로그를 조회한다")
        public String getCatalog() {
            catalogCalls.incrementAndGet();
            return catalogResult;
        }

        @Tool(name = "getMyChecklist", description = "사용자 체크리스트를 조회한다")
        public String getMyChecklist() {
            checklistCalls.incrementAndGet();
            return "checklist";
        }

        @Tool(name = "getMyWeddingDate", description = "사용자 결혼 날짜를 조회한다")
        public String getMyWeddingDate() {
            weddingDateCalls.incrementAndGet();
            return "weddingDate";
        }

        @Tool(name = "lookupOther", description = "자동 조회 대상이 아닌 도구")
        public String lookupOther() {
            otherCalls.incrementAndGet();
            return "other";
        }

        @Tool(name = "directRead", description = "결과를 바로 돌려주는 도구", returnDirect = true)
        public String directRead() {
            return "direct";
        }
    }

    static class DirectChecklistTools {

        @Tool(name = "getCatalog", description = "추천할 카탈로그를 조회한다")
        public String getCatalog() {
            return "catalog";
        }

        @Tool(name = "getMyChecklist", description = "사용자 체크리스트를 조회한다", returnDirect = true)
        public String getMyChecklist() {
            return "checklist";
        }
    }
}
