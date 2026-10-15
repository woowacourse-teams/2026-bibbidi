package com.bibbidi.wedding.chat.infra.ai;

import java.io.Writer;
import java.util.function.Consumer;

final class AnswerDeltaWriter extends Writer {

    private final Consumer<String> sendAnswerChunk;
    private final StringBuilder answer = new StringBuilder();
    private int sentLength;

    AnswerDeltaWriter(Consumer<String> sendAnswerChunk) {
        this.sendAnswerChunk = sendAnswerChunk;
    }

    @Override
    public void write(char[] text, int offset, int length) {
        answer.append(text, offset, length);
        int end = answer.length();
        if (end > 0 && Character.isHighSurrogate(answer.charAt(end - 1))) {
            end--;
        }
        if (end > sentLength) {
            sendAnswerChunk.accept(answer.substring(sentLength, end));
            sentLength = end;
        }
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
