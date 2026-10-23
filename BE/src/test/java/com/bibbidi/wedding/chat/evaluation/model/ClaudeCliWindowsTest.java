package com.bibbidi.wedding.chat.evaluation.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.evaluation.judge.BibbidiEvaluator;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.core.io.ClassPathResource;

@EnabledOnOs(OS.WINDOWS)
@Isolated("Windows 프로세스의 인자 처리 설정을 변경한다")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ClaudeCliWindowsTest {

    @TempDir
    static Path directory;

    private Path executable;
    private String originalArgumentMode;

    @BeforeAll
    void compileCliStub() throws IOException, InterruptedException {
        executable = directory.resolve("fake-cli.exe");
        Path source = copyFixture("claude-windows.cs", "FakeCli.cs");
        Path compiler = copyFixture("compile-windows-cli.ps1", "compile.ps1");
        compileExecutable(source, compiler);
    }

    @BeforeEach
    void rememberArgumentMode() {
        originalArgumentMode = System.getProperty("jdk.lang.Process.allowAmbiguousCommands");
    }

    @AfterEach
    void restoreArgumentMode() {
        if (originalArgumentMode == null) {
            System.clearProperty("jdk.lang.Process.allowAmbiguousCommands");
        } else {
            System.setProperty("jdk.lang.Process.allowAmbiguousCommands", originalArgumentMode);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"true", "false"})
    @DisplayName("Windows의 기본 모드와 엄격 모드에서 답변 CLI가 원본 JSON 스키마를 받는다")
    void passesAnswerSchemaWithoutCorruption(String allowAmbiguousCommands) throws IOException {
        System.setProperty("jdk.lang.Process.allowAmbiguousCommands", allowAmbiguousCommands);
        ClaudeCliChatModel model = new ClaudeCliChatModel(executable.toString(), "test", Duration.ofSeconds(10));

        model.call(new Prompt("question"));

        assertOriginalSchema("ai-evaluation/schema/agent-turn.json");
    }

    @ParameterizedTest
    @ValueSource(strings = {"true", "false"})
    @DisplayName("Windows의 기본 모드와 엄격 모드에서 채점 CLI가 원본 JSON 스키마를 받는다")
    void passesJudgeSchemaWithoutCorruption(String allowAmbiguousCommands) throws IOException {
        System.setProperty("jdk.lang.Process.allowAmbiguousCommands", allowAmbiguousCommands);
        ClaudeCliChatModel judge = new ClaudeCliChatModel(
                executable.toString(), "test", Duration.ofSeconds(10), BibbidiEvaluator.JUDGE_RESULT_SCHEMA);

        judge.call(new Prompt("question"));

        assertOriginalSchema("ai-evaluation/schema/judge-result.json");
    }

    private void compileExecutable(Path source, Path compiler) throws IOException, InterruptedException {
        Path compilerLog = directory.resolve("compiler.log");
        Process process = new ProcessBuilder("powershell.exe", "-NoProfile", "-NonInteractive",
                "-ExecutionPolicy", "Bypass", "-File", compiler.toString(), source.toString(), executable.toString())
                .redirectErrorStream(true)
                .redirectOutput(compilerLog.toFile())
                .start();
        process.getOutputStream().close();
        if (!process.waitFor(120, TimeUnit.SECONDS)) {
            process.destroyForcibly().onExit().join();
            throw new IllegalStateException("CLI stub compilation timed out: " + Files.readString(compilerLog));
        }
        assertThat(process.exitValue()).withFailMessage(Files.readString(compilerLog)).isZero();
    }

    private Path copyFixture(String resource, String name) throws IOException {
        Path target = directory.resolve(name);
        try (var input = new ClassPathResource("ai-evaluation/cli-stubs/" + resource).getInputStream()) {
            Files.copy(input, target);
        }
        return target;
    }

    private void assertOriginalSchema(String resource) throws IOException {
        String expected = new ClassPathResource(resource).getContentAsString(StandardCharsets.UTF_8);
        assertThat(Files.readString(directory.resolve("schema.json"))).isEqualTo(expected);
    }
}
