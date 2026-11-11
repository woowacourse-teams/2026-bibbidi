package com.bibbidi.wedding.chat.evaluation.model;

import com.bibbidi.wedding.chat.evaluation.cli.CliOutput;
import com.bibbidi.wedding.chat.evaluation.cli.CodexCli;
import java.time.Duration;
import org.springframework.ai.chat.metadata.DefaultUsage;
import tools.jackson.databind.JsonNode;

public class CodexCliChatModel extends CliChatModel {

    private final String model;
    private final CodexCli cli;

    public CodexCliChatModel(String model, String reasoningEffort, Duration timeout) {
        this(CodexCli.defaultExecutable(), model, reasoningEffort, timeout);
    }

    public CodexCliChatModel(String executable, String model, String reasoningEffort, Duration timeout) {
        this(executable, model, reasoningEffort, timeout, null);
    }

    /**
     * 도구 호출 없이 {@code structuredSchema}대로 한 번 답하는 모델을 만든다. 채점에 쓴다.
     */
    public static CodexCliChatModel structured(
            String model, String reasoningEffort, Duration timeout, String structuredSchema) {
        return new CodexCliChatModel(CodexCli.defaultExecutable(), model, reasoningEffort, timeout, structuredSchema);
    }

    public CodexCliChatModel(
            String executable, String model, String reasoningEffort, Duration timeout, String structuredSchema) {
        super(structuredSchema);
        this.model = model;
        this.cli = new CodexCli(executable, model, reasoningEffort, timeout,
                structuredSchema == null ? "Codex generation" : "Codex structured answer");
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
        return new DefaultUsage(usage.path("input_tokens").asInt(), usage.path("output_tokens").asInt(),
                null, usage, usage.has("cached_input_tokens") ? usage.path("cached_input_tokens").asLong() : null,
                null);
    }
}
