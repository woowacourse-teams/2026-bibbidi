package com.bibbidi.wedding.chat.adapter.ai.parser;

import java.io.Writer;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class AnswerDeltaWriter extends Writer {

    private final @Nullable Consumer<String> sendAnswerChunk;
    private final StringBuilder answer = new StringBuilder();
    private int sentLength;

    AnswerDeltaWriter() {
        this.sendAnswerChunk = null;
    }

    AnswerDeltaWriter(Consumer<String> sendAnswerChunk) {
        this.sendAnswerChunk = sendAnswerChunk;
    }

    @Override
    public void write(char[] text, int offset, int length) {
        writeDelta(text, offset, length);
    }

    String writeDelta(char[] text, int offset, int length) {
        answer.append(text, offset, length);
        int end = answer.length();
        if (end > 0 && Character.isHighSurrogate(answer.charAt(end - 1))) {
            end--;
        }
        if (end > sentLength) {
            String delta = answer.substring(sentLength, end);
            if (sendAnswerChunk != null) {
                sendAnswerChunk.accept(delta);
            }
            sentLength = end;
            return delta;
        }
        return "";
    }

    String text() {
        return answer.toString();
    }

    boolean hasPendingText() {
        return sentLength != answer.length();
    }

    @Override
    public void flush() {
    }

    @Override
    public void close() {
    }
}
