package com.bibbidi.wedding.chat.evaluation.model;

import com.bibbidi.wedding.chat.evaluation.cli.ClaudeCli;
import com.bibbidi.wedding.chat.evaluation.cli.CliOutput;
import java.time.Duration;
import org.springframework.ai.chat.metadata.DefaultUsage;
import tools.jackson.databind.JsonNode;

public class ClaudeCliChatModel extends CliChatModel {

    private final String model;
    private final ClaudeCli cli;

    public ClaudeCliChatModel(String model, Duration timeout) {
        this(ClaudeCli.defaultExecutable(), model, timeout);
    }

    public ClaudeCliChatModel(String executable, String model, Duration timeout) {
        this(executable, model, timeout, null);
    }

    /**
     * 도구 호출 없이 {@code structuredSchema}대로 한 번 답하는 모델을 만든다. 채점에 쓴다.
     */
    public static ClaudeCliChatModel structured(String model, Duration timeout, String structuredSchema) {
        return new ClaudeCliChatModel(ClaudeCli.defaultExecutable(), model, timeout, structuredSchema);
    }

    public ClaudeCliChatModel(String executable, String model, Duration timeout, String structuredSchema) {
        super(structuredSchema);
        this.model = model;
        this.cli = new ClaudeCli(executable, model, timeout,
                structuredSchema == null ? "Claude generation" : "Claude structured answer");
    }

    @Override
    protected String modelName() {
        return model;
    }

    @Override
    protected CliReply execute(String instructions, String transcript, String schemaResource) {
        CliOutput output = cli.run(instructions, transcript, schemaResource);
        return new CliReply(output.answer(), readUsage(output.usage()));
    }

    private DefaultUsage readUsage(JsonNode usage) {
        if (usage == null || usage.isNull() || !usage.has("input_tokens") || !usage.has("output_tokens")) {
            return null;
        }
        int input = usage.path("input_tokens").asInt();
        int output = usage.path("output_tokens").asInt();
        long cacheRead = usage.path("cache_read_input_tokens").asLong();
        long cacheWrite = usage.path("cache_creation_input_tokens").asLong();
        return new DefaultUsage(input, output, (int) (input + output + cacheRead + cacheWrite), usage,
                cacheRead, cacheWrite);
    }
}
