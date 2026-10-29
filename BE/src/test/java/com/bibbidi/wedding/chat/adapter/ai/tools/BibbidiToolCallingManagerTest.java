package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingProperties;
import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.support.ToolCallingFixture;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.tool.annotation.Tool;
import tools.jackson.databind.json.JsonMapper;

class BibbidiToolCallingManagerTest {

    private HttpServer server;
    private final AtomicInteger jevCalls = new AtomicInteger();

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/systemone", exchange -> {
            jevCalls.incrementAndGet();
            byte[] body = "{\"answers\":{\"next_tool\":{\"choice\":\"getMyChecklist\",\"confidence\":0.95}}}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
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
    void letsJevSelectAnotherReadToolBeforeReturningToModel() {
        ReadTools tools = new ReadTools();
        ModelRoutingProperties properties = new ModelRoutingProperties(
                "test-key", "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/systemone",
                "jev-latest", Duration.ofSeconds(2), 0.7);
        ToolCallingManager manager = new BibbidiToolCallingManager(
                ToolCallingManager.builder().build(), properties,
                new JevClient(properties, JsonMapper.builder().build()));
        ToolCallingFixture fixture = new ToolCallingFixture(manager, tools);

        fixture.callTool(7L, "getCatalog", "{}");

        assertThat(tools.catalogCalls.get()).isEqualTo(1);
        assertThat(tools.checklistCalls.get()).isEqualTo(1);
        assertThat(jevCalls.get()).isEqualTo(1);
    }

    static class ReadTools {

        private final AtomicInteger catalogCalls = new AtomicInteger();
        private final AtomicInteger checklistCalls = new AtomicInteger();

        @Tool(name = "getCatalog", description = "추천할 카탈로그를 조회한다")
        public String getCatalog() {
            catalogCalls.incrementAndGet();
            return "catalog";
        }

        @Tool(name = "getMyChecklist", description = "사용자 체크리스트를 조회한다")
        public String getMyChecklist() {
            checklistCalls.incrementAndGet();
            return "checklist";
        }
    }
}
