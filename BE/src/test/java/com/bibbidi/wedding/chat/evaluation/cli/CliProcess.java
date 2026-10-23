package com.bibbidi.wedding.chat.evaluation.cli;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class CliProcess {

    private final Duration timeout;
    private final String operation;

    public CliProcess(Duration timeout, String operation) {
        this.timeout = timeout;
        this.operation = operation;
    }

    public int execute(ProcessBuilder command) throws IOException, InterruptedException {
        Process process = command.redirectError(ProcessBuilder.Redirect.DISCARD).start();
        try {
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                terminate(process);
                throw new IllegalStateException(operation + " timed out", new TimeoutException());
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
