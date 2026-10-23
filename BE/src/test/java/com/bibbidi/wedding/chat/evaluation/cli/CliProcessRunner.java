package com.bibbidi.wedding.chat.evaluation.cli;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class CliProcessRunner {

    private final Duration timeout;
    private final String taskName;

    public CliProcessRunner(Duration timeout, String taskName) {
        this.timeout = timeout;
        this.taskName = taskName;
    }

    public int execute(ProcessBuilder command) throws IOException, InterruptedException {
        Process process = command.redirectError(ProcessBuilder.Redirect.DISCARD).start();
        try {
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                terminate(process);
                throw new IllegalStateException(taskName + " timed out", new TimeoutException());
            }
            return process.exitValue();
        } catch (InterruptedException exception) {
            terminate(process);
            throw exception;
        }
    }

    private void terminate(Process process) {
        process.destroyForcibly().onExit().join();
    }
}
