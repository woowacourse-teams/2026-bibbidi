package com.bibbidi.wedding.chat.evaluation.cli;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class ClaudeCli {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final String taskName;
    private final CliProcessRunner processRunner;

    public ClaudeCli(String executable, String model, Duration timeout, String taskName) {
        this.executable = executable;
        this.model = model;
        this.taskName = taskName;
        this.processRunner = new CliProcessRunner(timeout, taskName);
    }

    public static String defaultExecutable() {
        return System.getProperty("os.name").startsWith("Windows") ? "claude.exe" : "claude";
    }

    public CliOutput run(String instructions, String input, String schemaResource) {
        try (CliTempDirectory tempDirectory = new CliTempDirectory("bibbidi-claude-")) {
            tempDirectory.write("input.txt", input);
            if (instructions != null) {
                tempDirectory.write("instructions.md", instructions);
            }
            int exitCode = processRunner.execute(prepareProcess(tempDirectory, instructions != null, schemaResource));
            return readOutput(tempDirectory, exitCode);
        } catch (IOException exception) {
            throw new IllegalStateException(taskName + " output could not be read", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(taskName + " was interrupted", exception);
        }
    }

    private ProcessBuilder prepareProcess(CliTempDirectory tempDirectory, boolean hasInstructions, String schemaResource)
            throws IOException {
        List<String> command = new ArrayList<>(List.of(
                executable, "-p", "--safe-mode", "--no-session-persistence",
                "--tools", "", "--disallowedTools", "mcp__*", "--model", model));
        if (hasInstructions) {
            command.addAll(List.of("--system-prompt-file", tempDirectory.path("instructions.md").toString()));
        }
        command.addAll(List.of("--output-format", "json",
                "--json-schema", new CliOutputSchema(schemaResource).asCommandArgument()));
        return new ProcessBuilder(command)
                .directory(tempDirectory.directory().toFile())
                .redirectInput(tempDirectory.path("input.txt").toFile())
                .redirectOutput(tempDirectory.path("output.json").toFile());
    }

    private CliOutput readOutput(CliTempDirectory tempDirectory, int exitCode) throws IOException {
        String result = tempDirectory.read("output.json");
        if (result.isBlank()) {
            throw new IllegalStateException(taskName + " exited with code " + exitCode);
        }
        JsonNode envelope = objectMapper.readTree(result);
        if (exitCode != 0 || envelope.path("is_error").asBoolean()) {
            throw new IllegalStateException(taskName + " failed: "
                    + envelope.path("result").asString("exit code " + exitCode));
        }
        JsonNode answer = envelope.get("structured_output");
        if (answer == null || !answer.isObject()) {
            throw new IllegalStateException(taskName + " returned no structured output");
        }
        return new CliOutput(answer.toString(), envelope.get("usage"));
    }
}
