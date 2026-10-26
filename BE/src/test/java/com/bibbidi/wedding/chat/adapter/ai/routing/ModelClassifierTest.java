package com.bibbidi.wedding.chat.adapter.ai.routing;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.mock.env.MockEnvironment;
import tools.jackson.databind.json.JsonMapper;

class ModelClassifierTest {

    private HttpServer server;
    private ChatMemory memory;
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private final AtomicReference<String> responseBody = new AtomicReference<>();
    private int status;

    @BeforeEach
    void setUp() throws IOException {
        memory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(20)
                .build();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        responseBody.set("{\"answers\":{\"route\":{\"choice\":\"luna\",\"confidence\":0.95}}}");
        status = 200;
        server.createContext("/v1/systemone", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = responseBody.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length);
            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void includesRecentConversationAndSelectsLuna() {
        memory.add("conversation", List.of(new UserMessage("예산은 200만 원"), new AssistantMessage("알겠습니다.")));

        ChatModelTier result = classifier(0.7).classify("conversation", "조건에 맞춰 추천해줘").block();

        assertThat(result).isEqualTo(ChatModelTier.LUNA);
        assertThat(requestBody.get()).contains("예산은 200만 원", "조건에 맞춰 추천해줘", "\"type\":\"choice\"");
    }

    @Test
    void promotesUncertainChoiceToAdjacentHigherTier() {
        responseBody.set("{\"answers\":{\"route\":{\"choice\":\"qwen\",\"confidence\":0.4}}}");

        assertThat(classifier(0.7).classify("conversation", "추천해줘").block())
                .isEqualTo(ChatModelTier.LUNA);
    }

    @Test
    void fallsBackToSolWhenJevFails() {
        status = 503;

        assertThat(classifier(0.7).classify("conversation", "추천해줘").block())
                .isEqualTo(ChatModelTier.SOL);
    }

    private ModelClassifier classifier(double confidence) {
        ModelRoutingProperties properties = new ModelRoutingProperties("test-key",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/systemone",
                "jev-latest", Duration.ofSeconds(2), confidence, 6);
        return new ModelClassifier(memory, properties, JsonMapper.builder().build(), new MockEnvironment());
    }
}
