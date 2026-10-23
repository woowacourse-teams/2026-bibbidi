package com.bibbidi.wedding.chat.evaluation.cli;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.core.io.ClassPathResource;

public class CliJsonSchema {

    private final String content;

    public CliJsonSchema(String resource) throws IOException {
        content = new ClassPathResource(resource).getContentAsString(StandardCharsets.UTF_8);
    }

    public void writeTo(Path path) throws IOException {
        Files.writeString(path, content, StandardCharsets.UTF_8);
    }

    public String asArgument() {
        if (usesLegacyWindowsArguments()) {
            return content.replace("\"", "\\\"");
        }
        return content;
    }

    private boolean usesLegacyWindowsArguments() {
        // JDK의 엄격 모드(false)는 따옴표를 직접 이스케이프하므로 중복 처리하지 않는다.
        return System.getProperty("os.name").startsWith("Windows")
                && !"false".equalsIgnoreCase(System.getProperty("jdk.lang.Process.allowAmbiguousCommands", "true"));
    }
}
