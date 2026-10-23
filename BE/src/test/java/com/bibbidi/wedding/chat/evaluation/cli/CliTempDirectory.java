package com.bibbidi.wedding.chat.evaluation.cli;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

public class CliTempDirectory implements AutoCloseable {

    private final Path directory;

    public CliTempDirectory(String prefix) throws IOException {
        directory = Files.createTempDirectory(prefix);
    }

    public Path directory() {
        return directory;
    }

    public Path path(String name) {
        return directory.resolve(name);
    }

    public void write(String name, String content) throws IOException {
        Files.writeString(path(name), content, StandardCharsets.UTF_8);
    }

    public String read(String name) throws IOException {
        return Files.readString(path(name), StandardCharsets.UTF_8);
    }

    @Override
    public void close() throws IOException {
        try (Stream<Path> files = Files.list(directory)) {
            for (Path file : files.toList()) {
                Files.deleteIfExists(file);
            }
        }
        Files.deleteIfExists(directory);
    }
}
