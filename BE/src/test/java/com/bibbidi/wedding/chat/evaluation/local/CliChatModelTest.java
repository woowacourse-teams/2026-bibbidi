package com.bibbidi.wedding.chat.evaluation.local;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.chat.evaluation.claude.ClaudeCliChatModel;
import com.bibbidi.wedding.chat.evaluation.codex.CodexCliChatModel;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.ClaudeCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.CodexCliBibbidiJudge;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import tools.jackson.databind.ObjectMapper;

@EnabledOnOs({OS.LINUX, OS.MAC})
class CliChatModelTest {

    @TempDir
    Path directory;

    @ParameterizedTest
    @ValueSource(strings = {"codex", "claude"})
    @DisplayName("CLI에 시스템 안내문과 대화를 전달하고 구조화된 답변과 사용량을 읽는다")
    void passesInputsAndReadsStructuredAnswers(String provider) throws IOException {
        Path capturedInput = directory.resolve("input.txt");
        Path capturedSystem = directory.resolve("system.txt");
        String body = """
                answer=''
                while [ "$#" -gt 0 ]; do
                  case "$1" in
                    --output-last-message) shift; answer="$1" ;;
                    --system-prompt-file) shift; cp "$1" '%s' ;;
                    model_instructions_file=*) file=$(printf '%%s' "$1" | cut -d "'" -f 2); cp "$file" '%s' ;;
                  esac
                  shift
                done
                cat > '%s'
                if [ -n "$answer" ]; then
                  printf '%%s' '{"answer":"준비해요","recommendedItemIds":[7]}' > "$answer"
                  printf '%%s\n' '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5,"cached_input_tokens":3}}'
                else
                  printf '%%s\n' '{"structured_output":{"answer":"준비해요","recommendedItemIds":[7]},"usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":3,"cache_creation_input_tokens":2}}'
                fi
                """.formatted(capturedSystem, capturedSystem, capturedInput);
        ChatModel model = model(provider, script(body), Duration.ofSeconds(5));

        var response = model.call(new Prompt(List.of(new SystemMessage("고정 안내문"), new UserMessage("질문"))));

        assertThat(Files.readString(capturedSystem)).isEqualTo("고정 안내문");
        assertThat(Files.readString(capturedInput)).isEqualTo("[user]\n질문");
        var answer = new ObjectMapper().readTree(response.getResult().getOutput().getText());
        assertThat(answer.path("answer").asText()).isEqualTo("준비해요");
        assertThat(answer.path("recommendedItemIds").get(0).asInt()).isEqualTo(7);
        assertThat(response.getMetadata().getUsage().getTotalTokens()).isEqualTo("claude".equals(provider) ? 20 : 15);
        assertThat(response.getMetadata().getUsage().getCacheReadInputTokens()).isEqualTo(3);
    }

    @ParameterizedTest
    @ValueSource(strings = {"codex", "claude"})
    @DisplayName("CLI의 실패 종료를 성공 답변으로 취급하지 않는다")
    void rejectsFailedProcesses(String provider) throws IOException {
        ChatModel model = model(provider, script("cat > /dev/null\nexit 9\n"), Duration.ofSeconds(5));

        assertThatThrownBy(() -> model.call(new Prompt("question")))
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"codex", "claude"})
    @DisplayName("표준 입력을 읽지 않는 CLI도 제한 시간 뒤 종료하고 시간 초과 원인을 남긴다")
    void timesOutEvenWhenTheProcessDoesNotConsumeInput(String provider) throws IOException {
        ChatModel model = model(provider, script("exec sleep 10\n"), Duration.ofMillis(100));

        assertThatThrownBy(() -> model.call(new Prompt("large input".repeat(100_000))))
                .hasCauseInstanceOf(TimeoutException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"codex", "claude"})
    @DisplayName("사용량이 없는 CLI 응답은 사용량 미확인으로 남긴다")
    void preservesMissingUsage(String provider) throws IOException {
        String body = """
                answer=''
                while [ "$#" -gt 0 ]; do
                  if [ "$1" = '--output-last-message' ]; then shift; answer="$1"; fi
                  shift
                done
                if [ -n "$answer" ]; then
                  printf '%s' '{"answer":"text","recommendedItemIds":[]}' > "$answer"
                else
                  printf '%s' '{"structured_output":{"answer":"text","recommendedItemIds":[]}}'
                fi
                """;

        var response = model(provider, script(body), Duration.ofSeconds(5)).call(new Prompt("question"));

        assertThat(response.getMetadata().getUsage()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"codex", "claude"})
    @DisplayName("채점 CLI가 큰 입력을 읽지 않아도 시간 초과로 종료한다")
    void timesOutJudgesWithoutBlockingOnInput(String provider) throws IOException {
        String executable = script("exec sleep 10\n");
        BibbidiJudge judge = "codex".equals(provider)
                ? new CodexCliBibbidiJudge(executable, "test", "medium", Duration.ofMillis(100))
                : new ClaudeCliBibbidiJudge(executable, "test", Duration.ofMillis(100));

        assertThatThrownBy(() -> judge.evaluate(new Prompt("large input".repeat(100_000)), null, "timeout"))
                .hasCauseInstanceOf(TimeoutException.class);
    }

    private String script(String body) throws IOException {
        Path executable = directory.resolve("fake-cli");
        Files.writeString(executable, "#!/bin/sh\n" + body);
        Files.setPosixFilePermissions(executable, PosixFilePermissions.fromString("rwx------"));
        return executable.toString();
    }

    private ChatModel model(String provider, String executable, Duration timeout) {
        return "codex".equals(provider)
                ? new CodexCliChatModel(executable, "test", "medium", timeout)
                : new ClaudeCliChatModel(executable, "test", timeout);
    }
}
