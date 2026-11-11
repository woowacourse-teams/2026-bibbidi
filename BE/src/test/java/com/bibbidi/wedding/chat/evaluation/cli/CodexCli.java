package com.bibbidi.wedding.chat.evaluation.cli;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class CodexCli {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final String reasoningEffort;
    private final String taskName;
    private final CliProcessRunner processRunner;

    public CodexCli(String executable, String model, String reasoningEffort, Duration timeout, String taskName) {
        this.executable = executable;
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.taskName = taskName;
        this.processRunner = new CliProcessRunner(timeout, taskName);
    }

    public static String defaultExecutable() {
        return System.getProperty("os.name").startsWith("Windows") ? "codex.cmd" : "codex";
    }

    public CliOutput run(String instructions, String input, String schemaResource) {
        try (CliTempDirectory tempDirectory = new CliTempDirectory("bibbidi-codex-")) {
            tempDirectory.write("input.txt", input);
            if (instructions != null) {
                tempDirectory.write("instructions.md", instructions);
            }
            new CliOutputSchema(schemaResource).writeTo(tempDirectory.path("schema.json"));
            int exitCode = processRunner.execute(prepareProcess(tempDirectory, instructions != null));
            return readOutput(tempDirectory, exitCode);
        } catch (IOException exception) {
            throw new IllegalStateException(taskName + " output could not be read", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(taskName + " was interrupted", exception);
        }
    }

    private ProcessBuilder prepareProcess(CliTempDirectory tempDirectory, boolean hasInstructions) {
        List<String> command = new ArrayList<>(List.of(
                executable, "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                "--skip-git-repo-check", "--sandbox", "read-only", "--model", model,
                "--config", "model_reasoning_effort=" + reasoningEffort));
        if (hasInstructions) {
            command.addAll(List.of("--config",
                    "model_instructions_file='" + tempDirectory.path("instructions.md") + "'"));
        }
        command.addAll(List.of(
                "--output-schema", tempDirectory.path("schema.json").toString(),
                "--output-last-message", tempDirectory.path("answer.json").toString(), "-"));
        return new ProcessBuilder(command)
                .directory(tempDirectory.directory().toFile())
                .redirectInput(tempDirectory.path("input.txt").toFile())
                .redirectOutput(tempDirectory.path("events.jsonl").toFile());
    }

    private CliOutput readOutput(CliTempDirectory tempDirectory, int exitCode) throws IOException {
        String events = tempDirectory.read("events.jsonl");
        if (exitCode != 0) {
            throw new IllegalStateException(taskName + " failed: " + failureMessage(events));
        }
        return new CliOutput(tempDirectory.read("answer.json"), usageOf(events));
    }

    private JsonNode usageOf(String events) {
        JsonNode usage = null;
        for (String line : events.lines().toList()) {
            if (line.isBlank()) {
                continue;
            }
            JsonNode event = objectMapper.readTree(line);
            if ("turn.completed".equals(event.path("type").asText())) {
                usage = event.get("usage");
            }
        }
        return usage;
    }

    private String failureMessage(String events) {
        String message = "exit without message";
        for (String line : events.lines().toList()) {
            if (line.isBlank()) {
                continue;
            }
            JsonNode event = objectMapper.readTree(line);
            if ("turn.failed".equals(event.path("type").asText())) {
                message = event.path("error").path("message").asText(message);
            }
        }
        return message;
    }
}
